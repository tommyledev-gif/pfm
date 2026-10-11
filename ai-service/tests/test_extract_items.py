"""Items on an extracted transaction (specs/transaction-line-items, typed chat)."""

import pytest
from pydantic import ValidationError

from app.schemas.extract_schema import ExtractResponse
from app.services.extract_service import _extract_tool_schema
from app.services.prompt_builder import build_system_prompt


def _response(items: list[dict]) -> dict:
    return {
        "intent": "create_transaction",
        "transactions": [
            {
                "amount_vnd": 326000,
                "tx_type": "expense",
                "category_id": "c1",
                "wallet_id": None,
                "note": "Spaylater",
                "occurred_at": "2026-11-10",
                "confidence": 0.5,
                "items": items,
            }
        ],
    }


def test_items_parse_with_default_quantity():
    parsed = ExtractResponse.model_validate(_response([{"name": "Vớ đen + trắng", "amount_vnd": 95000}]))
    item = parsed.transactions[0].items[0]
    assert item.quantity == 1
    assert item.unit_price_vnd is None


def test_items_default_to_empty():
    payload = _response([])
    del payload["transactions"][0]["items"]
    assert ExtractResponse.model_validate(payload).transactions[0].items == []


def test_zero_quantity_rejected():
    with pytest.raises(ValidationError):
        ExtractResponse.model_validate(_response([{"name": "x", "quantity": 0, "amount_vnd": 1}]))


def test_tool_schema_is_flat_and_carries_items():
    schema = _extract_tool_schema()
    assert "$defs" not in str(schema) and "$ref" not in str(schema)
    item_schema = schema["properties"]["transactions"]["items"]["properties"]["items"]["items"]
    assert set(item_schema["properties"]) == {"name", "quantity", "unit_price_vnd", "amount_vnd"}


def test_prompt_states_grouping_and_day_month_rules():
    prompt = build_system_prompt([], [], "2026-10-11T00:00:00Z")
    assert "MỘT lần mua" in prompt
    assert '"10/11" = ngày 10 tháng 11' in prompt
