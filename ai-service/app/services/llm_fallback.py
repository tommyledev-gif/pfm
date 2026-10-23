"""Groq first, Anthropic second, for one structured call.

Shared by extract and category suggestion (specs/security-hardening-2026-10
US-08). The provider SDKs are synchronous, so both attempts run in the
threadpool: called straight from a coroutine they would freeze the event loop
(every other request and /health with it) for the whole round trip.

Failures are logged with provider_error_fields only — type, status and the
provider's code — never the error text, which can echo user content.
"""

import logging
from collections.abc import Callable
from typing import TypeVar

from fastapi.concurrency import run_in_threadpool

from app.core.llm_errors import provider_error_fields

logger = logging.getLogger(__name__)

T = TypeVar("T")


class LLMUnavailableError(Exception):
    """Both providers failed. Each service turns this into its own error, which
    its router answers with a 503."""


async def run_with_fallback(primary: Callable[[], T], fallback: Callable[[], T], *, operation: str, prompt_chars: int) -> T:
    """Returns primary()'s result, or fallback()'s when primary raises.

    Pass lambdas that look the provider functions up at call time (for example
    `lambda: _call_groq(...)`), so a test can replace a service's own
    `_call_groq` / `_call_anthropic`."""
    try:
        return await run_in_threadpool(primary)
    except Exception as exc:  # noqa: BLE001 - any primary failure falls back, never propagates raw
        logger.warning(
            f"groq {operation} failed, falling back to anthropic",
            extra={"prompt_chars": prompt_chars, **provider_error_fields(exc)},
        )
    try:
        return await run_in_threadpool(fallback)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            f"anthropic {operation} fallback also failed",
            extra={"prompt_chars": prompt_chars, **provider_error_fields(exc)},
        )
        raise LLMUnavailableError(operation) from exc
