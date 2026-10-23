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
counts and the failure type/code (never prompt content or provider error
text — both may contain arbitrary user text), and never let a raw LLM error
propagate as a 500 to the Go Backend. The provider calls and the fallback
order live in llm_tools.py and llm_fallback.py.
"""

from app.core.config import settings
from app.core.groq_client import get_anthropic_client, get_groq_client
from app.schemas.extract_schema import ChatTurn, ExtractRequest, ExtractResponse
from app.services.item_names import clean_item_names
from app.services.llm_fallback import LLMUnavailableError, run_with_fallback
from app.services.llm_tools import ToolSpec, anthropic_tool_arguments, dereference_schema, groq_tool_arguments
from app.services.prompt_builder import build_system_prompt

_TOOL_NAME = "extract_transactions"
_TOOL_DESCRIPTION = "Extract structured transaction proposals from a Vietnamese natural-language message."
_LOG_LABEL = "extraction"


class ExtractionUnavailableError(Exception):
    """Raised when both Groq and Anthropic fail — the router maps this to a
    503, which the Go Backend's AIServiceClient turns into 502
    AI_SERVICE_UNAVAILABLE (specs/ai-chat-assistant/spec.md S-AI-10)."""


async def extract_transactions(req: ExtractRequest) -> ExtractResponse:
    system_prompt = build_system_prompt(req.wallets, req.categories, req.now)
    try:
        response = await run_with_fallback(
            lambda: _call_groq(system_prompt, req.history, req.message),
            lambda: _call_anthropic(system_prompt, req.history, req.message),
            operation=_LOG_LABEL,
            prompt_chars=len(req.message),
        )
    except LLMUnavailableError as exc:
        raise ExtractionUnavailableError from exc
    # The prompt and the tool schema ask for item names without prices, but
    # neither is a guarantee: whatever either provider leaves in is stripped
    # here (item_names.py).
    return clean_item_names(response)


def _extract_tool_schema() -> dict:
    """ExtractResponse's schema with its $ref nesting (transactions → items)
    inlined, which Groq's forced tool_choice needs (llm_tools.dereference_schema)."""
    return dereference_schema(ExtractResponse.model_json_schema())


def _tool() -> ToolSpec:
    return ToolSpec(name=_TOOL_NAME, description=_TOOL_DESCRIPTION, schema=_extract_tool_schema())


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


def _conversation(history: list[ChatTurn], message: str) -> list[dict]:
    return [*_history_messages(history), {"role": "user", "content": message}]


def _call_groq(system_prompt: str, history: list[ChatTurn], message: str) -> ExtractResponse:
    arguments = groq_tool_arguments(
        get_groq_client(),
        model=settings.groq_model,
        tool=_tool(),
        system_prompt=system_prompt,
        messages=_conversation(history, message),
        max_tokens=settings.extract_max_tokens,
        temperature=settings.temperature,
        log_label=_LOG_LABEL,
        prompt_chars=len(message),
    )
    return ExtractResponse.model_validate(arguments)


def _call_anthropic(system_prompt: str, history: list[ChatTurn], message: str) -> ExtractResponse:
    arguments = anthropic_tool_arguments(
        get_anthropic_client(),
        model=settings.anthropic_model,
        tool=_tool(),
        system_prompt=system_prompt,
        messages=_conversation(history, message),
        max_tokens=settings.extract_max_tokens,
        log_label=_LOG_LABEL,
        prompt_chars=len(message),
    )
    return ExtractResponse.model_validate(arguments)
