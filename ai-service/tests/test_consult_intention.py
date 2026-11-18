"""Reading planned purchases (specs/ai-chat-spending-intentions US-01).

The model only supplies what the User said, one entry per thing named; these
tests pin that nothing it could invent (a Category it was never shown, a title
it did not read) reaches the backend as a plan.
"""

import json

from app.schemas.consult_schema import (
    ConsultCategory,
    ConsultIntentionItem,
    ConsultRequest,
    ConsultToolOutput,
    ConsultUsage,
    ConsultWallet,
)
from app.services.consult_prompt import build_consult_prompt
from app.services.consult_service import to_response
from app.services.llm_tools import dereference_schema

SHOPPING = ConsultCategory(id="cat-shopping", name="Mua sắm", type="expense")
HEALTH = ConsultCategory(id="cat-health", name="Sức khỏe", type="expense")
SALARY = ConsultCategory(id="cat-salary", name="Lương", type="income")
CASH = ConsultWallet(id="w-cash", name="Tiền mặt", currency="VND", is_default=True)


def _request() -> ConsultRequest:
    return ConsultRequest(
        message="niềng răng trả góp 12 tháng 1tr5, mua nước hoa 2tr, mua sữa tắm",
        categories=[SHOPPING, HEALTH, SALARY],
        wallets=[CASH],
        today="2026-10-14",
        timezone="Asia/Ho_Chi_Minh",
    )


def _item(**fields) -> ConsultIntentionItem:
    fields.setdefault("kind", "one_time")
    return ConsultIntentionItem(**fields)


def _respond(*items: ConsultIntentionItem, truncated: bool = False):
    output = ConsultToolOutput(kind="intention", coverage="full", intentions=list(items), intentions_truncated=truncated)
    return to_response(output, _request(), "niem rang tra gop", ConsultUsage())


def test_each_thing_named_becomes_its_own_plan_in_order() -> None:
    reply = _respond(
        _item(title="Niềng răng", kind="installment", monthly_vnd=1_500_000, months=12, category_id="cat-health", category_confidence=0.8),
        _item(title="Mua nước hoa", amount_vnd=2_000_000, month="2026-11", category_id="cat-shopping", category_confidence=0.9),
        _item(title="Mua sữa tắm"),
    )
    assert reply.kind == "intention"
    assert [p.title for p in reply.intentions] == ["Niềng răng", "Mua nước hoa", "Mua sữa tắm"]
    braces, perfume, gel = reply.intentions
    # Only what the User said: the payment is not derived from a total, the price is not guessed.
    assert (braces.monthly_vnd, braces.months, braces.amount_vnd) == (1_500_000, 12, None)
    assert (perfume.amount_vnd, perfume.month, perfume.category_id, perfume.category_confidence) == (2_000_000, "2026-11", "cat-shopping", 0.9)
    assert (gel.amount_vnd, gel.category_id, gel.category_confidence) == (None, None, None)
    assert reply.query is None and reply.intentions_truncated is False


def test_a_missing_kind_follows_the_months() -> None:
    # The tool schema requires a kind; a client that sends none (an older model) still reads sensibly.
    plan = _respond(_item(title="Laptop", kind="installment", months=6)).intentions[0]
    assert plan.kind == "installment"
    assert _respond(_item(title="Sữa tắm")).intentions[0].kind == "one_time"


def test_a_category_the_model_was_never_shown_is_dropped_with_its_confidence() -> None:
    plan = _respond(_item(title="Nước hoa", category_id="cat-invented", category_confidence=0.95)).intentions[0]
    assert plan.category_id is None and plan.category_confidence is None


def test_an_income_category_is_not_a_plan_category() -> None:
    plan = _respond(_item(title="Nước hoa", category_id="cat-salary", category_confidence=0.95)).intentions[0]
    assert plan.category_id is None


def test_an_item_with_no_title_is_left_out_and_the_rest_stay() -> None:
    reply = _respond(_item(title="   ", amount_vnd=500_000), _item(title="Nước hoa", amount_vnd=2_000_000))
    assert [p.title for p in reply.intentions] == ["Nước hoa"]


def test_nothing_usable_is_not_a_plan() -> None:
    reply = _respond(_item(title="   "))
    assert reply.kind == "unsupported" and reply.coverage == "partial" and reply.intentions == []
    assert _respond().kind == "unsupported"


def test_naming_more_than_allowed_is_flagged() -> None:
    reply = _respond(_item(title="Nước hoa"), truncated=True)
    assert reply.intentions_truncated is True


def test_an_empty_month_means_this_month() -> None:
    assert _respond(_item(title="Nước hoa", month="")).intentions[0].month is None


def test_the_tool_schema_is_inlined_and_lists_the_items() -> None:
    schema = dereference_schema(ConsultToolOutput.model_json_schema())
    assert "$ref" not in json.dumps(schema) and "$defs" not in schema
    fields = set(schema["properties"]["intentions"]["items"]["properties"])
    assert {"title", "kind", "amount_vnd", "monthly_vnd", "months", "month", "category_id", "category_confidence"} <= fields
    assert schema["properties"]["intentions"]["maxItems"] == 5


def test_the_prompt_prints_the_months_for_the_model_to_copy() -> None:
    prompt = build_consult_prompt([SHOPPING], [CASH], "2026-10-14", "Asia/Ho_Chi_Minh")
    assert "Tháng này là 2026-10. Tháng sau là 2026-11." in prompt
    december = build_consult_prompt([SHOPPING], [CASH], "2026-12-30", "Asia/Ho_Chi_Minh")
    assert "Tháng sau là 2027-01." in december


def test_the_prompt_asks_for_one_entry_per_thing_and_keeps_questions_and_records_out() -> None:
    prompt = build_consult_prompt([SHOPPING], [CASH], "2026-10-14", "Asia/Ho_Chi_Minh")
    assert '"intention"' in prompt
    assert "MỘT phần tử cho MỖI món" in prompt
    assert "intentions_truncated" in prompt
    assert "KHÔNG phải intention" in prompt  # a question is a scenario
    assert "là transaction_like, không phải intention" in prompt  # an expense already made
