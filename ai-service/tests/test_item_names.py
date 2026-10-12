"""Item-name safety net after /extract (app/services/item_names.py)."""

import asyncio

import pytest

from app.schemas.extract_schema import ExtractRequest, ExtractResponse
from app.services import extract_service
from app.services.item_names import clean_item_name


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # A remark the model left in stays: moving it is the model's job.
        ("sữa đặc 22k của duy", "sữa đặc của duy"),
        ("khăn giấy 18k", "khăn giấy"),
        ("tương ớt chinsu 35.000đ", "tương ớt chinsu"),
        ("tương ớt chinsu 35K", "tương ớt chinsu"),
        ("bia x2", "bia"),
        ("bia × 2", "bia"),
        ("tai nghe 1tr2", "tai nghe"),
        ("nồi cơm 1.5tr", "nồi cơm"),
        ("tủ lạnh 2 triệu", "tủ lạnh"),
        ("gạo 50 nghìn", "gạo"),
        ("trà sữa 35000", "trà sữa"),
        ("trà sữa 35000d", "trà sữa"),
        ("sữa tươi 30.000 VND", "sữa tươi"),
        ("bia 15k/lon", "bia"),
        ("bánh (35k)", "bánh"),
        ("bánh 20k, 2 cái", "bánh, 2 cái"),
    ],
)
def test_strips_prices_and_quantity_markers(raw: str, expected: str) -> None:
    assert clean_item_name(raw) == expected


@pytest.mark.parametrize(
    "name",
    [
        "7up",  # a digit inside a product name is not a price
        "k",
        "bia 333",
        "nước suối 500ml",
        "thịt bò 5kg",
        "kính 3D",
        "pin dự phòng 20000mAh",
        "giấy A4",
        "Galaxy S24",
        "Vớ đen + trắng",
        "sách C++",
    ],
)
def test_leaves_names_without_prices_unchanged(name: str) -> None:
    assert clean_item_name(name) == name


@pytest.mark.parametrize("name", ["35k", "22k, 18k", "x2"])
def test_never_empties_a_name(name: str) -> None:
    assert clean_item_name(name) == name


def test_extract_cleans_item_names_from_the_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    provider_output = ExtractResponse.model_validate(
        {
            "intent": "create_transaction",
            "transactions": [
                {
                    "amount_vnd": 75000,
                    "tx_type": "expense",
                    "category_id": "c1",
                    "note": "sữa đặc của duy",
                    "occurred_at": "2026-10-12",
                    "confidence": 0.9,
                    "items": [
                        {"name": "tương ớt chinsu 35k", "amount_vnd": 35000},
                        {"name": "sữa đặc 22k", "amount_vnd": 22000},
                        {"name": "khăn giấy 18k", "amount_vnd": 18000},
                    ],
                }
            ],
        }
    )
    monkeypatch.setattr(extract_service, "_call_groq", lambda *_args: provider_output)
    req = ExtractRequest(
        message="tương ớt chinsu 35k, sữa đặc 22k của duy, khăn giấy 18k",
        wallets=[],
        categories=[],
        now="2026-10-12T03:00:00Z",
    )

    result = asyncio.run(extract_service.extract_transactions(req))

    transaction = result.transactions[0]
    assert [item.name for item in transaction.items] == ["tương ớt chinsu", "sữa đặc", "khăn giấy"]
    assert transaction.note == "sữa đặc của duy"
