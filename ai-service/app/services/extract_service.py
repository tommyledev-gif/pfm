"""Groq-primary, Anthropic-fallback extraction logic for POST /extract.

Uses tool/function calling on both providers, not prose-described JSON mode —
a prose "return this exact JSON shape" instruction is not reliably followed
even in `response_format={"type": "json_object"}` mode: field names/types
drift from what was asked (observed directly against the real Groq API —
the model returned `amount`/`type`/`date` instead of the requested
`amount_vnd`/`tx_type`/`occurred_at`). Forcing a tool call against
ExtractResponse's own JSON schema makes the provider's output structurally
conform by construction, and keeps the schema itself as the single source of
truth (dev.md LLM Rules).

dev.md LLM Rules: max_tokens always explicit, log only prompt length/token
counts and the failure type/message (never prompt content — may contain
arbitrary user text), wrap every SDK call in try/except with a typed
fallback, never let a raw LLM error propagate as a 500 to the Go Backend.
"""

import json
import logging
from copy import deepcopy

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.groq_client import get_anthropic_client, get_groq_client
from app.schemas.extract_schema import ChatTurn, ExtractRequest, ExtractResponse
from app.services.prompt_builder import build_system_prompt

logger = logging.getLogger(__name__)

_TOOL_NAME = "extract_transactions"
_TOOL_DESCRIPTION = "Extract structured transaction proposals from a Vietnamese natural-language message."


class ExtractionUnavailableError(Exception):
    """Raised when both Groq and Anthropic fail — the router maps this to a
    503, which the Go Backend's AIServiceClient turns into 502
    AI_SERVICE_UNAVAILABLE (specs/ai-chat-assistant/spec.md S-AI-10)."""


async def extract_transactions(req: ExtractRequest) -> ExtractResponse:
    system_prompt = build_system_prompt(req.wallets, req.categories, req.now)

    # The SDK clients are synchronous: called directly from this coroutine they
    # would freeze the event loop (every other request and /health with it)
    # for the whole provider round trip.
    try:
        return await run_in_threadpool(_call_groq, system_prompt, req.history, req.message)
    except Exception as exc:  # noqa: BLE001 - any Groq failure falls back, never propagates raw
        logger.warning(
            "groq extraction failed, falling back to anthropic",
            extra={"prompt_chars": len(req.message), "error_type": type(exc).__name__, "error": str(exc)},
        )
        try:
            return await run_in_threadpool(_call_anthropic, system_prompt, req.history, req.message)
        except Exception as fallback_exc:  # noqa: BLE001
            logger.error(
                "anthropic fallback also failed",
                extra={
                    "prompt_chars": len(req.message),
                    "error_type": type(fallback_exc).__name__,
                    "error": str(fallback_exc),
                },
            )
            raise ExtractionUnavailableError from fallback_exc


def _dereference_schema(schema: dict) -> dict:
    """Inlines Pydantic's `$defs`/`$ref` indirection (used here for
    ExtractResponse.transactions: list[ProposedTransaction]).

    Live-tested against the real Groq API (2026-08-17, migrating off the
    decommissioned llama-3.3-70b-versatile): both openai/gpt-oss-120b and
    -20b mishandle a $ref-nested schema under forced tool_choice — silently
    dropping a required field (`confidence`) or, on gpt-oss-120b, emitting a
    stray `json`/`functions.<name>` tool call instead of the requested one.
    A fully flattened schema fixed both providers to a 0/10 failure rate
    across a Vietnamese-input regression set, without touching any actual
    field definition — ExtractResponse stays the single source of truth,
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


def _extract_tool_schema() -> dict:
    return _dereference_schema(ExtractResponse.model_json_schema())


def _history_messages(history: list[ChatTurn]) -> list[dict]:
    """Converts stored history turns into chat-message dicts, defensively
    dropping any leading non-"user" turn.

    Anthropic's API requires its messages array to start with "user" and
    strictly alternate roles — the chat_messages table always writes a user
    message immediately followed by exactly one assistant reply
    (ChatService.Chat), so the last N rows only fail to start on "user" if
    common.AIChatHistoryLimit is ever changed from its current even value to
    an odd one. This makes that case fail safe (drop the stray turn) instead
    of erroring out the whole request.
    """
    turns = list(history)
    while turns and turns[0].role != "user":
        turns.pop(0)
    return [{"role": turn.role, "content": turn.content} for turn in turns]


def _call_groq(system_prompt: str, history: list[ChatTurn], message: str) -> ExtractResponse:
    client = get_groq_client()
    tool = {
        "type": "function",
        "function": {"name": _TOOL_NAME, "description": _TOOL_DESCRIPTION, "parameters": _extract_tool_schema()},
    }
    completion = client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=settings.extract_max_tokens,
        temperature=settings.temperature,
        tools=[tool],
        tool_choice={"type": "function", "function": {"name": _TOOL_NAME}},
        messages=[
            {"role": "system", "content": system_prompt},
            *_history_messages(history),
            {"role": "user", "content": message},
        ],
    )
    tool_calls = completion.choices[0].message.tool_calls
    if not tool_calls:
        raise ValueError("groq response contained no tool call")
    completion_tokens = completion.usage.completion_tokens if completion.usage else None
    logger.info("groq extraction completed", extra={"prompt_chars": len(message), "completion_tokens": completion_tokens})
    return ExtractResponse.model_validate(json.loads(tool_calls[0].function.arguments))


def _call_anthropic(system_prompt: str, history: list[ChatTurn], message: str) -> ExtractResponse:
    client = get_anthropic_client()
    tool = {"name": _TOOL_NAME, "description": _TOOL_DESCRIPTION, "input_schema": _extract_tool_schema()}
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.extract_max_tokens,
        temperature=settings.temperature,
        system=system_prompt,
        tools=[tool],
        tool_choice={"type": "tool", "name": _TOOL_NAME},
        messages=[
            *_history_messages(history),
            {"role": "user", "content": message},
        ],
    )
    tool_use_blocks = [block for block in response.content if block.type == "tool_use"]
    if not tool_use_blocks:
        raise ValueError("anthropic response contained no tool_use block")
    logger.info("anthropic fallback completed", extra={"prompt_chars": len(message)})
    return ExtractResponse.model_validate(tool_use_blocks[0].input)
