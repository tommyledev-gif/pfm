"""Offline tests for the provider seam and the extract-image flow
(specs/ai-chat-image-capture plan AIIMG-T09b, F34, F40, F41)."""

import asyncio
import logging
from types import SimpleNamespace

import groq
import httpx
import pytest

from app.schemas.extract_image_schema import ExtractImageRequest
from app.schemas.extract_schema import CategoryContext, WalletContext
from app.services import extract_image_service, vision_provider
from app.services.extract_image_service import ExtractImageUnavailableError, extract_image
from app.services.vision_provider import VisionBusyError, VisionResult, VisionTruncatedError, VisionUnavailableError

CAPTION_SECRET = "ví MB caption-secret"
NOTE_SECRET = "note-secret"
GOOD_ARGS = {
    "intent": "create_transaction",
    "source_kind": "receipt",
    "transactions": [{"amount_vnd": 145000, "tx_type": "expense", "category_id": "cat-food", "note": NOTE_SECRET,
                      "occurred_at": "2026-10-02", "confidence": 0.9}],
}


def _request() -> ExtractImageRequest:
    return ExtractImageRequest(
        image_base64="aGVsbG8=", mime_type="image/jpeg", caption=CAPTION_SECRET,
        wallets=[WalletContext(id="w", name="Tiền mặt", is_default=True, currency="VND")],
        categories=[CategoryContext(id="cat-food", name="Ăn uống", type="expense")],
        now="2026-10-18T03:00:00Z", max_items=20,
    )


def _groq_error(cls: type, status: int, code: str | None = None, headers: dict | None = None) -> Exception:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(status, request=request, headers=headers or {})
    return cls("provider error", response=response, body={"code": code} if code else None)


def _with_reads(monkeypatch: pytest.MonkeyPatch, outcomes: list) -> list[int]:
    """Replaces read_image with a scripted sequence; returns the max_tokens of each call."""
    seen: list[int] = []

    def fake_read(system_prompt: str, caption: str | None, data_url: str, max_tokens: int) -> VisionResult:
        seen.append(max_tokens)
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return VisionResult(arguments=outcome, prompt_tokens=10, completion_tokens=5, finish_reason="tool_calls")

    monkeypatch.setattr(extract_image_service, "read_image", fake_read)
    return seen


def test_happy_path_returns_the_reading(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _with_reads(monkeypatch, [GOOD_ARGS])
    resp = asyncio.run(extract_image(_request()))
    assert resp.transactions[0].amount_vnd == 145000 and seen == [1500]


def test_truncated_reading_retries_once_with_a_larger_allowance(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _with_reads(monkeypatch, [VisionTruncatedError(), GOOD_ARGS])
    resp = asyncio.run(extract_image(_request()))
    assert resp.transactions and seen == [1500, 4000]


def test_truncated_twice_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    _with_reads(monkeypatch, [VisionTruncatedError(), VisionTruncatedError()])
    with pytest.raises(ExtractImageUnavailableError):
        asyncio.run(extract_image(_request()))


def test_busy_is_never_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _with_reads(monkeypatch, [VisionBusyError(40)])
    with pytest.raises(VisionBusyError) as info:
        asyncio.run(extract_image(_request()))
    assert info.value.retry_after_seconds == 40 and seen == [1500]


def test_outage_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    _with_reads(monkeypatch, [VisionUnavailableError()])
    with pytest.raises(ExtractImageUnavailableError):
        asyncio.run(extract_image(_request()))


def test_logs_never_carry_caption_or_values(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    _with_reads(monkeypatch, [GOOD_ARGS])
    with caplog.at_level(logging.INFO):
        asyncio.run(extract_image(_request()))
    dumped = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert CAPTION_SECRET not in dumped and NOTE_SECRET not in dumped and "aGVsbG8=" not in dumped


def _fake_client(monkeypatch: pytest.MonkeyPatch, create) -> None:
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(vision_provider, "get_groq_vision_client", lambda: client)


def test_provider_maps_429_to_busy_with_retry_after(monkeypatch: pytest.MonkeyPatch) -> None:
    def create(**_: object):
        raise _groq_error(groq.RateLimitError, 429, "rate_limit_exceeded", {"retry-after": "39.2"})

    _fake_client(monkeypatch, create)
    with pytest.raises(VisionBusyError) as info:
        vision_provider.read_image("p", None, "data:image/jpeg;base64,AA", 2500)
    assert info.value.retry_after_seconds == 40


def test_provider_maps_429_without_header_to_unknown_wait(monkeypatch: pytest.MonkeyPatch) -> None:
    def create(**_: object):
        raise _groq_error(groq.RateLimitError, 429)

    _fake_client(monkeypatch, create)
    with pytest.raises(VisionBusyError) as info:
        vision_provider.read_image("p", None, "data:image/jpeg;base64,AA", 2500)
    assert info.value.retry_after_seconds is None


def test_provider_maps_tool_use_failed_to_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    def create(**_: object):
        raise _groq_error(groq.BadRequestError, 400, "tool_use_failed")

    _fake_client(monkeypatch, create)
    with pytest.raises(VisionTruncatedError):
        vision_provider.read_image("p", None, "data:image/jpeg;base64,AA", 2500)


def test_provider_maps_withdrawn_model_to_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def create(**_: object):
        raise _groq_error(groq.NotFoundError, 404, "model_not_found")

    _fake_client(monkeypatch, create)
    with pytest.raises(VisionUnavailableError):
        vision_provider.read_image("p", None, "data:image/jpeg;base64,AA", 2500)


def test_provider_maps_length_finish_to_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    choice = SimpleNamespace(finish_reason="length", message=SimpleNamespace(tool_calls=None))
    _fake_client(monkeypatch, lambda **_: SimpleNamespace(choices=[choice], usage=None))
    with pytest.raises(VisionTruncatedError):
        vision_provider.read_image("p", None, "data:image/jpeg;base64,AA", 2500)


def test_provider_sends_reasoning_effort_and_forced_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}
    call = SimpleNamespace(function=SimpleNamespace(arguments='{"intent": "no_transactions", "source_kind": "other"}'))
    choice = SimpleNamespace(finish_reason="tool_calls", message=SimpleNamespace(tool_calls=[call]))

    def create(**kwargs: object):
        captured.update(kwargs)
        return SimpleNamespace(choices=[choice], usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1))

    _fake_client(monkeypatch, create)
    result = vision_provider.read_image("p", "ví MB", "data:image/jpeg;base64,AA", 2500)
    assert captured["reasoning_effort"] == "none" and captured["max_tokens"] == 2500
    assert captured["tool_choice"]["function"]["name"] == "record_transactions"
    assert result.arguments == {"intent": "no_transactions", "source_kind": "other"}
