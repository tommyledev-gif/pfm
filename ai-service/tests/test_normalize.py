"""Offline unit tests for the query-path normalizer (plan.md AIQ-T30)."""

import pytest

from app.nlu.normalize import normalize, unaccent


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Tháng này   tiêu bao nhiêu? ", "thang nay tieu bao nhieu?"),
        ("thang nay tieu bao nhieu cho an uong", "thang nay tieu bao nhieu cho an uong"),
        ("thang nay tiu bn", "thang nay tieu bao nhieu"),
        ("tôi tiêu bao nhiêu tháng này", "tieu bao nhieu thang nay"),
        ("t tiêu bn", "tieu bao nhieu"),
        ("mình chi ntn", "chi nhu the nao"),
        ("bữa h tiêu bao nhiêu", "30 ngay qua tieu bao nhieu"),
        ("dạo này chi nhiều ko", "30 ngay qua chi nhieu khong"),
    ],
)
def test_normalize_text(raw: str, expected: str) -> None:
    assert normalize(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("chi trên 50k tuần này", "chi tren 50000 tuan nay"),
        ("k biết tháng này tiêu bao nhiêu", "khong biet thang nay tieu bao nhieu"),
        ("khoản trên 1tr", "khoan tren 1000000"),
        ("khoản trên 1tr5", "khoan tren 1500000"),
        ("trên 1.5 triệu", "tren 1500000"),
        ("trên 1,25 triệu", "tren 1250000"),
        ("trên 500 nghìn", "tren 500000"),
        ("trên 2 củ", "tren 2000000"),
    ],
)
def test_normalize_amounts(raw: str, expected: str) -> None:
    assert normalize(raw) == expected


def test_digit_k_is_thousand_but_bare_k_is_not() -> None:
    assert normalize("50k") == "50000"
    assert normalize("k") == "khong"


def test_adjective_to_is_not_a_pronoun() -> None:
    # "tớ" (I) is dropped; "to" (big) survives.
    assert normalize("tớ muốn xem khoản to nhất") == "muon xem khoan to nhat"


def test_unaccent_handles_d_stroke() -> None:
    assert unaccent("Đi đâu") == "Di dau"
