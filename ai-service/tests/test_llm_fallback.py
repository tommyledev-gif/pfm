"""Offline tests for the shared provider calls and the Groq → Anthropic
fallback (specs/security-hardening-2026-10 US-08, S-HRD-37…40)."""

import asyncio
import logging
from types import SimpleNamespace

import groq
import httpx
import pytest

from app.core.config import settings
from app.core.llm_errors import NoToolCallError, provider_error_fields
from app.schemas.budget_schema import CategorySuggestionResponse
from app.schemas.extract_schema import ExtractRequest, ExtractResponse
from app.services import category_suggestion_service, extract_service

USER_TEXT = "mua sữa đặc 22k của duy"


def _request() -> ExtractRequest:
    return ExtractRequest(message=USER_TEXT, wallets=[], categories=[], now="2026-10-23T03:00:00Z")


def _groq_tool_use_failed() -> groq.BadRequestError:
    response = httpx.Response(400, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"))
    body = {"error": {"code": "tool_use_failed", "message": "bad call", "failed_generation": f'{{"note": "{USER_TEXT}"}}'}}
    return groq.BadRequestError(f"Error code: 400 - {body}", response=response, body=body)


def _groq_client_raising(exc: Exception) -> SimpleNamespace:
    def create(**_: object):
        raise exc

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_provider_error_fields_carry_no_text() -> None:
    fields = provider_error_fields(_groq_tool_use_failed())
    assert fields == {"error_type": "BadRequestError", "status_code": 400, "error_code": "tool_use_failed"}
    assert provider_error_fields(NoToolCallError("anthropic", "refusal"))["stop_reason"] == "refusal"
    assert provider_error_fields(ValueError(USER_TEXT)) == {"error_type": "ValueError"}


# S-HRD-37 / S-HRD-38: the fallback runs, and the log never repeats what the
# user wrote, even though the provider's error text does.
def test_fallback_log_has_code_not_user_text(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    monkeypatch.setattr(extract_service, "get_groq_client", lambda: _groq_client_raising(_groq_tool_use_failed()))
    monkeypatch.setattr(extract_service, "_call_anthropic", lambda *_args: ExtractResponse(intent="ambiguous"))

    with caplog.at_level(logging.INFO):
        result = asyncio.run(extract_service.extract_transactions(_request()))

    assert result == ExtractResponse(intent="ambiguous")
    falling_back = [r for r in caplog.records if "falling back" in r.getMessage()]
    assert len(falling_back) == 1 and falling_back[0].error_code == "tool_use_failed"
    for record in caplog.records:
        rendered = f"{record.getMessage()} {record.__dict__}"
        assert USER_TEXT not in rendered and "failed_generation" not in rendered


# S-HRD-39: the Anthropic request uses the configured model, forces the tool,
# and sends no sampling parameter the current models reject.
def test_anthropic_request_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}

    def create(**kwargs: object):
        seen.update(kwargs)
        block = SimpleNamespace(type="tool_use", input={"suggested_name": "Hẹn hò", "type": "expense", "icon": "x"})
        return SimpleNamespace(content=[block], stop_reason="tool_use", usage=SimpleNamespace(output_tokens=12))

    monkeypatch.setattr(category_suggestion_service, "get_anthropic_client", lambda: SimpleNamespace(messages=SimpleNamespace(create=create)))
    result = category_suggestion_service._call_anthropic("đi chơi")

    assert result == CategorySuggestionResponse(suggested_name="Hẹn hò", type="expense", icon="x")
    assert seen["model"] == settings.anthropic_model == "claude-haiku-5-5"
    assert seen["tool_choice"] == {"type": "tool", "name": "suggest_category"}
    assert "temperature" not in seen and "top_p" not in seen and "top_k" not in seen
    assert seen["max_tokens"] == settings.max_tokens


def test_anthropic_refusal_is_a_failure_not_a_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    refusal = SimpleNamespace(content=[], stop_reason="refusal", usage=None)
    monkeypatch.setattr(extract_service, "get_anthropic_client", lambda: SimpleNamespace(messages=SimpleNamespace(create=lambda **_: refusal)))
    with pytest.raises(NoToolCallError) as info:
        extract_service._call_anthropic("p", [], USER_TEXT)
    assert info.value.stop_reason == "refusal"


# S-HRD-40: both providers down is the service's own unavailable error (→ 503).
def test_both_down_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def down(*_args: object) -> CategorySuggestionResponse:
        raise RuntimeError("down")

    monkeypatch.setattr(category_suggestion_service, "_call_groq", down)
    monkeypatch.setattr(category_suggestion_service, "_call_anthropic", down)
    with pytest.raises(category_suggestion_service.CategorySuggestionUnavailableError):
        asyncio.run(category_suggestion_service.suggest_category("đi chơi"))
