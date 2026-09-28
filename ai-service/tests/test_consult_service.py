"""Offline tests for consult post-processing and the prompt (plan.md AIQ-T31…T33)."""

from app.schemas.consult_schema import ConsultCategory, ConsultRequest, ConsultToolOutput, ConsultUsage, ConsultWallet
from app.services.consult_prompt import build_consult_prompt
from app.services.consult_service import _usage, to_response

FOOD = ConsultCategory(id="11111111-1111-4111-8111-111111111111", name="Ăn uống", type="expense")
SALARY = ConsultCategory(id="22222222-2222-4222-8222-222222222222", name="Lương", type="income")
CASH = ConsultWallet(id="33333333-3333-4333-8333-333333333333", name="Tiền mặt", currency="VND", is_default=True)


def _req() -> ConsultRequest:
    return ConsultRequest(message="q", categories=[FOOD, SALARY], wallets=[CASH], today="2026-10-14", timezone="Asia/Ho_Chi_Minh")


def test_full_query_maps_and_serializes_from_alias() -> None:
    out = ConsultToolOutput(
        kind="query", coverage="full", metric="sum", period="custom",
        from_date="2026-09-01", to_date="2026-09-15", category_ids=[FOOD.id], category_confidence=0.9,
    )
    resp = to_response(out, _req(), "norm", ConsultUsage(prompt_tokens=10))
    body = resp.model_dump(by_alias=True)
    assert body["query"]["from"] == "2026-09-01"
    assert body["query"]["category_ids"] == [FOOD.id]
    assert body["category_confidence"] == 0.9


def test_invented_category_id_marks_partial() -> None:
    out = ConsultToolOutput(kind="query", coverage="full", metric="sum", period="this_cycle", category_ids=["not-in-list"])
    resp = to_response(out, _req(), "norm", ConsultUsage())
    assert resp.coverage == "partial" and resp.query is None


def test_invented_wallet_id_marks_partial() -> None:
    out = ConsultToolOutput(kind="query", coverage="full", metric="sum", period="this_cycle", wallet_id="nope")
    assert to_response(out, _req(), "n", ConsultUsage()).coverage == "partial"


def test_query_without_metric_is_partial() -> None:
    out = ConsultToolOutput(kind="query", coverage="full", period="this_cycle")
    assert to_response(out, _req(), "n", ConsultUsage()).coverage == "partial"


def test_non_query_carries_no_question_and_no_confidence() -> None:
    out = ConsultToolOutput(kind="evaluate", coverage="full", category_confidence=0.3)
    resp = to_response(out, _req(), "n", ConsultUsage())
    assert resp.query is None and resp.category_confidence is None


def test_prompt_lists_categories_by_type_and_ids() -> None:
    prompt = build_consult_prompt([FOOD, SALARY], [CASH], "2026-10-14", "Asia/Ho_Chi_Minh")
    expense_block = prompt.split("Danh mục CHI TIÊU")[1].split("Danh mục THU NHẬP")[0]
    assert FOOD.id in expense_block and SALARY.id not in expense_block
    assert "2026-10-14" in prompt


class _Details:
    cached_tokens = 120


class _Usage:
    prompt_tokens = 300
    completion_tokens = 40
    prompt_tokens_details = _Details()


def test_usage_reads_cached_tokens_when_present() -> None:
    usage = _usage(_Usage())
    assert (usage.prompt_tokens, usage.completion_tokens, usage.cached_tokens) == (300, 40, 120)
    assert _usage(None).prompt_tokens == 0


def test_provider_error_code_reads_only_the_code() -> None:
    from app.services.consult_service import _provider_error_code

    class FakeGroqError(Exception):
        body = {"error": {"code": "tool_use_failed", "failed_generation": "question text"}}

    assert _provider_error_code(FakeGroqError()) == "tool_use_failed"
    assert _provider_error_code(ValueError("no body")) is None


def _groq_error(cls: type, status: int, code: str) -> Exception:
    import httpx

    response = httpx.Response(status, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"))
    return cls("provider error", response=response, body={"code": code})


def _run_consult_raising(monkeypatch, exc: Exception):
    import asyncio

    from app.services import consult_service

    def boom(*_args: object) -> None:
        raise exc

    monkeypatch.setattr(consult_service, "_call_groq", boom)
    return asyncio.run(consult_service.consult(_req()))


def test_truncated_tool_call_is_unsupported_not_unavailable(monkeypatch) -> None:
    import groq

    resp = _run_consult_raising(monkeypatch, _groq_error(groq.BadRequestError, 400, "tool_use_failed"))
    assert resp.kind == "unsupported" and resp.coverage == "partial" and resp.invalid_output and resp.query is None


def test_schema_breaking_output_is_unsupported(monkeypatch) -> None:
    from pydantic import ValidationError

    try:
        ConsultToolOutput.model_validate({"kind": "query", "coverage": "full", "period": "today"})
    except ValidationError as exc:
        assert _run_consult_raising(monkeypatch, exc).invalid_output


def test_missing_tool_call_is_unsupported(monkeypatch) -> None:
    from app.services.consult_service import _NoToolCallError

    assert _run_consult_raising(monkeypatch, _NoToolCallError("none")).invalid_output


def test_provider_outages_stay_unavailable(monkeypatch) -> None:
    import groq
    import pytest

    from app.services.consult_service import ConsultUnavailableError

    for exc in (
        _groq_error(groq.RateLimitError, 429, "rate_limit_exceeded"),
        _groq_error(groq.BadRequestError, 400, "model_decommissioned"),
        _groq_error(groq.AuthenticationError, 401, "invalid_api_key"),
    ):
        with pytest.raises(ConsultUnavailableError):
            _run_consult_raising(monkeypatch, exc)


def test_prompt_prints_day_anchors_across_a_month_edge() -> None:
    prompt = build_consult_prompt([FOOD], [CASH], "2026-10-01", "Asia/Ho_Chi_Minh")
    assert "Hôm nay là 2026-10-01" in prompt
    assert "Hôm qua là 2026-09-30" in prompt and "Hôm kia là 2026-09-29" in prompt


def test_prompt_day_anchors_across_a_year_edge() -> None:
    prompt = build_consult_prompt([FOOD], [CASH], "2027-01-01", "Asia/Ho_Chi_Minh")
    assert "Hôm qua là 2026-12-31" in prompt
