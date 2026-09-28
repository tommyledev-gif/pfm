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
