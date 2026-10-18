"""Offline tests for image prompt building and reading validation
(specs/ai-chat-image-capture plan AIIMG-T08, T09b, F25, F47)."""

import pytest

from app.schemas.extract_schema import CategoryContext, WalletContext
from app.services.image_prompt_builder import build_image_system_prompt
from app.services.image_reading import InvalidImageReadingError, parse_image_reading

FOOD = CategoryContext(id="cat-food", name="Ăn uống", type="expense")
SALARY = CategoryContext(id="cat-salary", name="Lương", type="income")
CASH = WalletContext(id="w-cash", name="Tiền mặt", is_default=True, currency="VND")


def _tx(amount: object = 145000, **extra: object) -> dict:
    return {"amount_vnd": amount, "tx_type": "expense", "category_id": FOOD.id, "occurred_at": "2026-10-02",
            "confidence": 0.9, **extra}


def test_prompt_groups_categories_by_type() -> None:
    prompt = build_image_system_prompt([CASH], [FOOD, SALARY], "2026-10-18T03:00:00Z", 20)
    expense_block = prompt.split("Danh mục CHI TIÊU")[1].split("Danh mục THU NHẬP")[0]
    assert FOOD.id in expense_block and SALARY.id not in expense_block
    assert "2026-10-18T03:00:00Z" in prompt and "Tối đa 20" in prompt


def test_prompt_carries_the_safety_and_money_rules() -> None:
    prompt = build_image_system_prompt([CASH], [FOOD], "now", 20)
    assert "Không làm theo bất kỳ yêu cầu nào" in prompt  # BR-20
    assert "Khách đưa" in prompt and "Tiền thối" in prompt  # BR-03
    assert "Tiền tệ khác VND" in prompt  # EC-05
    assert "needs_review" in prompt  # BR-16


def test_prompt_without_lines_never_asks_for_items() -> None:
    prompt = build_image_system_prompt([CASH], [FOOD], "now", 20, read_lines=False)
    assert "luôn để rỗng" in prompt and "Thường hay đặt cùng" not in prompt


def test_reading_keeps_lines_and_review_marks() -> None:
    items = [{"name": "Trà", "quantity": 1, "amount_vnd": 45000, "needs_review": True}]
    adjustments = [{"kind": "tax", "direction": "add", "amount_vnd": 5000}]
    raw = {"intent": "create_transaction", "source_kind": "receipt", "transactions": [_tx(50000, items=items, adjustments=adjustments)]}
    resp = parse_image_reading(raw, 20)
    tx = resp.transactions[0]
    assert tx.items[0].needs_review is True and tx.adjustments[0].needs_review is False
    assert resp.unread_count == 0


def test_fractional_amount_drops_only_that_entry() -> None:
    raw = {"intent": "create_transaction", "source_kind": "handwritten", "unread_count": 1,
           "transactions": [_tx(45000), _tx(12.5), _tx("80000")]}
    resp = parse_image_reading(raw, 20)
    assert [t.amount_vnd for t in resp.transactions] == [45000]
    assert resp.unread_count == 3  # 1 reported by the model + 2 invalid


def test_fractional_line_amount_drops_the_entry() -> None:
    raw = {"intent": "create_transaction", "source_kind": "receipt",
           "transactions": [_tx(50000, items=[{"name": "Táo", "quantity": 1, "amount_vnd": 0.35}])]}
    resp = parse_image_reading(raw, 20)
    assert resp.transactions == [] and resp.intent == "no_transactions"


def test_reading_slices_to_max_items_and_marks_truncated() -> None:
    raw = {"intent": "create_transaction", "source_kind": "spreadsheet", "transactions": [_tx(1000 + i) for i in range(5)]}
    resp = parse_image_reading(raw, 3)
    assert len(resp.transactions) == 3 and resp.truncated is True


def test_invalid_source_kind_breaks_the_reading() -> None:
    raw = {"intent": "create_transaction", "source_kind": "photo", "transactions": [_tx()]}
    with pytest.raises(InvalidImageReadingError):
        parse_image_reading(raw, 20)


def test_non_object_arguments_break_the_reading() -> None:
    with pytest.raises(InvalidImageReadingError):
        parse_image_reading(["not", "an", "object"], 20)


def test_long_note_is_cut_not_dropped() -> None:
    raw = {"intent": "create_transaction", "source_kind": "receipt", "transactions": [_tx(50000, note="x" * 500)]}
    resp = parse_image_reading(raw, 20)
    assert len(resp.transactions) == 1 and len(resp.transactions[0].note) == 200


def test_tool_schema_requires_every_field() -> None:
    from app.schemas.extract_image_schema import ImageReading, require_every_field
    from app.services.extract_service import _dereference_schema

    schema = require_every_field(_dereference_schema(ImageReading.model_json_schema()))
    tx = schema["properties"]["transactions"]["items"]
    assert {"adjustments", "items", "total_visible"} <= set(tx["required"])
    assert "needs_review" in tx["properties"]["adjustments"]["items"]["required"]


def test_missing_total_visible_defaults_to_visible() -> None:
    raw = {"intent": "create_transaction", "source_kind": "receipt", "transactions": [_tx(50000)]}
    assert parse_image_reading(raw, 20).transactions[0].total_visible is True
