"""Interprets one free-text spending question for POST /consult.

specs/ai-chat-query-spending/plan.md AIQ-T33. Differences from /extract,
each deliberate:
- Groq only, no Anthropic fallback: the Go backend gives this call a short
  budget and degrades on failure (spec.md S-AIQ-40/41); a second provider
  attempt would blow that budget.
- A dedicated client with max_retries=0: the SDK default retries twice,
  including on 429, which the design forbids (brief §II.13.3).
- The blocking SDK call runs in a worker thread, so a slow provider does not
  stall every other request on the event loop.
- Token usage, including cached tokens, is returned to the backend for the
  question log — the only way to verify the provider's cached-token
  accounting (brief §II.1.3).
- A question made only of known phrases ("tiêu hnay", "danh mục tiêu hôm
  nay") is read by app/nlu/intent_rules.py and never reaches the model.

Only lengths and token counts are logged, never question text.
"""

import json
import logging

import groq
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.core.config import settings
from app.core.groq_client import get_groq_consult_client
from app.core.llm_errors import provider_error_code
from app.nlu.intent_rules import read_simple_question
from app.nlu.normalize import normalize
from app.schemas.consult_schema import (
    ConsultQuery,
    ConsultRequest,
    ConsultResponse,
    ConsultScenario,
    ConsultToolOutput,
    ConsultUsage,
)
from app.services.consult_prompt import build_consult_prompt

logger = logging.getLogger(__name__)

_TOOL_NAME = "classify_spending_question"
_TOOL_DESCRIPTION = "Classify a Vietnamese spending question and map it to a structured question."


# Groq's code for a tool call it could not accept: truncated arguments,
# arguments that break the schema, or no tool call at all.
_TOOL_USE_FAILED = "tool_use_failed"


class ConsultUnavailableError(Exception):
    """Provider failure — the router maps this to 503, which the backend turns
    into a degraded reply (never an error screen)."""


class _NoToolCallError(Exception):
    """The provider answered, but without the forced tool call."""


async def consult(req: ConsultRequest) -> ConsultResponse:
    normalized = normalize(req.message)
    ruled = read_simple_question(normalized, req.today)
    if ruled is not None:
        # Read completely by the phrase rules: no tokens, no provider call.
        logger.info("consult interpretation by phrase rules", extra={"prompt_chars": len(req.message)})
        return ConsultResponse(
            kind="query", coverage="full", query=ruled, normalized_text=normalized, usage=ConsultUsage(), method="regex"
        )
    system_prompt = build_consult_prompt(req.categories, req.wallets, req.today, req.timezone)
    user_message = f"Câu gốc: {req.message}\nDạng chuẩn hoá: {normalized}"
    try:
        output, usage = await run_in_threadpool(_call_groq, system_prompt, user_message)
    except Exception as exc:  # noqa: BLE001 - classified below, never propagates raw
        log_extra = {"prompt_chars": len(req.message), "error_type": type(exc).__name__, "error_code": provider_error_code(exc)}
        if _is_invalid_output(exc):
            # ⚠️ The provider is up; the model's reading did not fit the
            # catalog. Telling the User "temporarily unavailable" here is a
            # false outage (spec.md S-AIQ-60, plan.md BR-26).
            logger.warning("consult interpretation invalid", extra=log_extra)
            return invalid_output_response(normalized)
        logger.warning("consult interpretation failed", extra=log_extra)
        raise ConsultUnavailableError from exc
    return to_response(output, req, normalized, usage)


def invalid_output_response(normalized: str) -> ConsultResponse:
    """Out of scope, never figures. Usage is unknown: a rejected call reports
    none, so the backend's token window under-counts it (plan.md R-F27)."""
    return ConsultResponse(kind="unsupported", coverage="partial", normalized_text=normalized, usage=ConsultUsage(), invalid_output=True)


def _is_invalid_output(exc: Exception) -> bool:
    if isinstance(exc, (ValidationError, json.JSONDecodeError, _NoToolCallError)):
        return True
    return isinstance(exc, groq.BadRequestError) and provider_error_code(exc) == _TOOL_USE_FAILED


def to_response(output: ConsultToolOutput, req: ConsultRequest, normalized: str, usage: ConsultUsage) -> ConsultResponse:
    """Turns the tool output into the wire response. An id the model was never
    shown means it invented one — the question is then marked partial rather
    than silently dropping the filter (spec.md US-03 EC)."""
    coverage = output.coverage
    query = None
    if output.kind == "query":
        known_categories = {c.id for c in req.categories}
        known_wallets = {w.id for w in req.wallets}
        invented = any(cid not in known_categories for cid in output.category_ids) or (
            output.wallet_id is not None and output.wallet_id not in known_wallets
        )
        if invented or output.metric is None or output.period is None:
            coverage = "partial"
        else:
            query = ConsultQuery(
                metric=output.metric,
                group_by=output.group_by,
                tx_type=output.tx_type,
                period=output.period,
                from_=output.from_date,
                to=output.to_date,
                category_ids=output.category_ids,
                wallet_id=output.wallet_id,
                amount_min_vnd=output.amount_min_vnd,
                limit=output.limit,
            )
    scenario = None
    if output.kind == "scenario" and output.goal_amount_vnd is not None:
        scenario = ConsultScenario(
            goal_amount_vnd=output.goal_amount_vnd,
            goal_deadline=output.goal_deadline,
            monthly_save_vnd=output.monthly_save_vnd,
        )
    return ConsultResponse(
        kind=output.kind,
        coverage=coverage,
        query=query,
        scenario=scenario,
        category_confidence=output.category_confidence if output.category_ids else None,
        normalized_text=normalized,
        usage=usage,
    )


def _call_groq(system_prompt: str, user_message: str) -> tuple[ConsultToolOutput, ConsultUsage]:
    client = get_groq_consult_client()
    tool = {
        "type": "function",
        "function": {
            "name": _TOOL_NAME,
            "description": _TOOL_DESCRIPTION,
            "parameters": ConsultToolOutput.model_json_schema(),
        },
    }
    completion = client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=settings.consult_max_tokens,
        reasoning_effort=settings.consult_reasoning_effort,
        temperature=settings.temperature,
        tools=[tool],
        tool_choice={"type": "function", "function": {"name": _TOOL_NAME}},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    tool_calls = completion.choices[0].message.tool_calls
    if not tool_calls:
        raise _NoToolCallError("groq response contained no tool call")
    usage = _usage(completion.usage)
    completion_details = getattr(completion.usage, "completion_tokens_details", None)
    logger.info(
        "consult interpretation completed",
        extra={
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "cached_tokens": usage.cached_tokens,
            # Reasoning share and finish reason are what show a creeping
            # truncation before it starts failing calls (plan.md R-F19).
            "reasoning_tokens": getattr(completion_details, "reasoning_tokens", None),
            "finish_reason": completion.choices[0].finish_reason,
        },
    )
    return ConsultToolOutput.model_validate(json.loads(tool_calls[0].function.arguments)), usage


def _usage(raw: object) -> ConsultUsage:
    """Reads usage defensively — cached-token details are not guaranteed to
    be present on every provider response."""
    if raw is None:
        return ConsultUsage()
    details = getattr(raw, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", None) if details is not None else None
    return ConsultUsage(
        prompt_tokens=getattr(raw, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(raw, "completion_tokens", 0) or 0,
        cached_tokens=cached or 0,
    )
