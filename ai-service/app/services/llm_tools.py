"""Forced tool calls on Groq and Anthropic, returning the tool's arguments.

One place for the provider request shape that extract and category suggestion
used to repeat (specs/security-hardening-2026-10 US-08), plus the schema
flattening every forced-tool service needs. Callers validate the returned
arguments with their own Pydantic model, which stays the single source of
truth for the schema.

Logs carry only lengths and token counts, never prompt or completion text.
"""

import json
import logging
from copy import deepcopy
from dataclasses import dataclass

import anthropic
import groq

from app.core.llm_errors import NoToolCallError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ToolSpec:
    """The one tool a call forces: its name, description and JSON schema."""

    name: str
    description: str
    schema: dict


def dereference_schema(schema: dict) -> dict:
    """Inlines Pydantic's `$defs`/`$ref` indirection.

    Live-tested against the real Groq API (2026-08-17, migrating off the
    decommissioned llama-3.3-70b-versatile): both openai/gpt-oss-120b and
    -20b mishandle a $ref-nested schema under forced tool_choice — silently
    dropping a required field (`confidence`) or, on gpt-oss-120b, emitting a
    stray `json`/`functions.<name>` tool call instead of the requested one.
    A fully flattened schema fixed both providers to a 0/10 failure rate
    across a Vietnamese-input regression set, without touching any actual
    field definition — the Pydantic model stays the single source of truth,
    this only removes the indirection Groq's schema validator can't follow.
    """
    defs = schema.get("$defs", {})

    def resolve(node):
        if isinstance(node, dict):
            if "$ref" in node:
                key = node["$ref"].rsplit("/", 1)[-1]
                return resolve(deepcopy(defs[key]))
            return {k: resolve(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)


def groq_tool_arguments(
    client: groq.Groq,
    *,
    model: str,
    tool: ToolSpec,
    system_prompt: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    log_label: str,
    prompt_chars: int,
) -> dict:
    """One Groq chat completion forced to call `tool`; returns its arguments.
    Raises NoToolCallError when the reply has no tool call."""
    completion = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        tools=[{"type": "function", "function": {"name": tool.name, "description": tool.description, "parameters": tool.schema}}],
        tool_choice={"type": "function", "function": {"name": tool.name}},
        messages=[{"role": "system", "content": system_prompt}, *messages],
    )
    choice = completion.choices[0]
    tool_calls = choice.message.tool_calls
    if not tool_calls:
        raise NoToolCallError("groq", choice.finish_reason)
    completion_tokens = completion.usage.completion_tokens if completion.usage else None
    logger.info(f"groq {log_label} completed", extra={"prompt_chars": prompt_chars, "completion_tokens": completion_tokens})
    return json.loads(tool_calls[0].function.arguments)


def anthropic_tool_arguments(
    client: anthropic.Anthropic,
    *,
    model: str,
    tool: ToolSpec,
    system_prompt: str,
    messages: list[dict],
    max_tokens: int,
    log_label: str,
    prompt_chars: int,
) -> dict:
    """One Anthropic message forced to use `tool`; returns its input.

    No `temperature`: current Claude models reject any non-default sampling
    parameter with a 400 (the fallback model before them was retired, which
    is why the fallback had been failing every call). The forced tool and the
    caller's schema validation keep the output structured. Raises
    NoToolCallError when the reply has no tool_use block, including a refusal
    (stop_reason "refusal")."""
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        tools=[{"name": tool.name, "description": tool.description, "input_schema": tool.schema}],
        tool_choice={"type": "tool", "name": tool.name},
        messages=messages,
    )
    tool_use_blocks = [block for block in response.content if block.type == "tool_use"]
    if not tool_use_blocks:
        raise NoToolCallError("anthropic", response.stop_reason)
    output_tokens = response.usage.output_tokens if response.usage else None
    logger.info(f"anthropic {log_label} completed", extra={"prompt_chars": prompt_chars, "completion_tokens": output_tokens})
    return tool_use_blocks[0].input
