"""Offline tests: extract and category suggestion must not block the event loop.

Both services call synchronous provider SDKs. Called straight from a
coroutine, one slow provider round trip froze every other request (and
/health) on the worker; they now run in the threadpool, like consult.
"""

import asyncio
import time

import pytest

from app.core import groq_client
from app.core.config import settings
from app.schemas.budget_schema import CategorySuggestionResponse
from app.schemas.extract_schema import ExtractRequest, ExtractResponse
from app.services import category_suggestion_service, extract_service

_BLOCK_SECONDS = 0.3


def _extract_request() -> ExtractRequest:
    return ExtractRequest(message="an trua 50k", wallets=[], categories=[], now="2026-10-09T03:00:00Z")


def _ticks_while(coro_factory) -> tuple[object, int]:
    """Runs the coroutine next to a 10 ms ticker and returns its result plus
    how many ticks fired. A blocked loop fires (almost) none."""

    async def run() -> tuple[object, int]:
        ticks = 0

        async def ticker() -> None:
            nonlocal ticks
            while True:
                await asyncio.sleep(0.01)
                ticks += 1

        task = asyncio.create_task(ticker())
        try:
            result = await coro_factory()
        finally:
            task.cancel()
        return result, ticks

    return asyncio.run(run())


def test_extract_keeps_event_loop_responsive(monkeypatch: pytest.MonkeyPatch) -> None:
    def slow_groq(*_args: object) -> ExtractResponse:
        time.sleep(_BLOCK_SECONDS)
        return ExtractResponse(intent="ambiguous")

    monkeypatch.setattr(extract_service, "_call_groq", slow_groq)

    result, ticks = _ticks_while(lambda: extract_service.extract_transactions(_extract_request()))

    assert result == ExtractResponse(intent="ambiguous")
    assert ticks >= 10, f"event loop was blocked: only {ticks} ticks in {_BLOCK_SECONDS}s"


def test_extract_falls_back_to_anthropic_off_the_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing_groq(*_args: object) -> ExtractResponse:
        raise RuntimeError("groq down")

    def slow_anthropic(*_args: object) -> ExtractResponse:
        time.sleep(_BLOCK_SECONDS)
        return ExtractResponse(intent="ambiguous")

    monkeypatch.setattr(extract_service, "_call_groq", failing_groq)
    monkeypatch.setattr(extract_service, "_call_anthropic", slow_anthropic)

    result, ticks = _ticks_while(lambda: extract_service.extract_transactions(_extract_request()))

    assert result == ExtractResponse(intent="ambiguous")
    assert ticks >= 10


def test_extract_reports_unavailable_when_both_providers_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing(*_args: object) -> ExtractResponse:
        raise RuntimeError("down")

    monkeypatch.setattr(extract_service, "_call_groq", failing)
    monkeypatch.setattr(extract_service, "_call_anthropic", failing)

    with pytest.raises(extract_service.ExtractionUnavailableError):
        asyncio.run(extract_service.extract_transactions(_extract_request()))


def test_category_suggestion_keeps_event_loop_responsive(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = CategorySuggestionResponse(suggested_name="Hẹn hò", type="expense", icon="💕")

    def slow_groq(_description: str) -> CategorySuggestionResponse:
        time.sleep(_BLOCK_SECONDS)
        return expected

    monkeypatch.setattr(category_suggestion_service, "_call_groq", slow_groq)

    result, ticks = _ticks_while(lambda: category_suggestion_service.suggest_category("đi chơi"))

    assert result == expected
    assert ticks >= 10, f"event loop was blocked: only {ticks} ticks in {_BLOCK_SECONDS}s"


def test_provider_clients_have_bounded_timeouts_and_no_sdk_retries() -> None:
    groq_client.get_groq_client.cache_clear()
    groq_client.get_anthropic_client.cache_clear()
    try:
        primary = groq_client.get_groq_client()
        fallback = groq_client.get_anthropic_client()

        assert primary.max_retries == 0 and primary.timeout == settings.primary_timeout_seconds
        assert fallback.max_retries == 0 and fallback.timeout == settings.fallback_timeout_seconds
        # Together they must fit inside the Go backend's 15 s request budget.
        assert settings.primary_timeout_seconds + settings.fallback_timeout_seconds < 15
    finally:
        groq_client.get_groq_client.cache_clear()
        groq_client.get_anthropic_client.cache_clear()
