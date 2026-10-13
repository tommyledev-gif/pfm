"""Offline tests for the phrase rules that read common questions without a
model call (app/nlu/intent_rules.py), and for how consult() uses them."""

import asyncio
import json

import pytest

from app.nlu.intent_rules import read_simple_question
from app.nlu.normalize import normalize
from app.schemas.consult_schema import ConsultRequest, ConsultResponse, ConsultToolOutput, ConsultUsage
from tests.test_consult_golden import CATEGORIES, GOLDEN, GOLDEN_TODAY, WALLETS, _matches

TODAY = GOLDEN_TODAY  # 2026-10-14
YESTERDAY = "2026-10-13"


def _read(text: str):
    return read_simple_question(normalize(text), TODAY)


def _shape(text: str) -> tuple:
    q = _read(text)
    assert q is not None, f"{text!r} should be read by the phrase rules"
    return (q.metric, q.group_by, q.tx_type, q.period, q.from_, q.to)


TODAY_BREAKDOWN = ("breakdown", "category", None, "custom", TODAY, TODAY)
YESTERDAY_BREAKDOWN = ("breakdown", "category", None, "custom", YESTERDAY, YESTERDAY)


# Every way of asking what the money went on is the same question.
@pytest.mark.parametrize(
    "text",
    [
        "danh mục tiêu hnay",
        "Danh muc tieu hom nay?",
        "tiền đi đâu hnay",
        "tien di dau hom nay",
        "hôm nay tiêu vào gì",
        "hôm nay tiêu cái gì",
        "hôm nay chi những gì",
        "hum nay tiêu j",
        "nay tiêu gì",
        "bữa nay xài vào đâu",
        "đã mua gì hôm nay",
        "xem danh mục hôm nay",
        "hôm nay tiêu những gì",
        "ngày hôm nay chi vào những đâu",
    ],
)
def test_what_did_i_spend_on_today_is_one_question(text: str) -> None:
    assert _shape(text) == TODAY_BREAKDOWN


@pytest.mark.parametrize("text", ["tiêu j hqua", "hqua chi những gì", "bữa qua xài gì", "hôm wa tiêu vào đâu", "danh mục hôm qua"])
def test_what_did_i_spend_on_yesterday(text: str) -> None:
    assert _shape(text) == YESTERDAY_BREAKDOWN


@pytest.mark.parametrize(
    ("text", "period"),
    [
        ("tiền đi đâu hết rồi", "this_cycle"),
        ("tien di dau j het r", "this_cycle"),
        ("tháng nì danh mục nào tiêu nhiều nhất", "this_cycle"),
        ("chi những gì tuần này", "this_week"),
        ("tuần ni tiêu vào gì", "this_week"),
        ("tháng trước tiền đi đâu", "last_cycle"),
        ("tháng rồi tiêu gì", "last_cycle"),
        ("dạo này tiêu vào đâu", "last_30_days"),
    ],
)
def test_what_on_over_longer_periods(text: str, period: str) -> None:
    assert _shape(text) == ("breakdown", "category", None, period, None, None)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("tiêu hnay", ("sum", None, None, "custom", TODAY, TODAY)),
        ("hôm nay tiêu bao nhiêu", ("sum", None, None, "custom", TODAY, TODAY)),
        ("hnay chi bn", ("sum", None, None, "custom", TODAY, TODAY)),
        ("chi tiêu hôm nay", ("sum", None, None, "custom", TODAY, TODAY)),
        ("tiêu hum qua", ("sum", None, None, "custom", YESTERDAY, YESTERDAY)),
        ("hôm kia tiêu hết bao nhiêu", ("sum", None, None, "custom", "2026-10-12", "2026-10-12")),
        ("tháng nì tiêu bao nhiêu", ("sum", None, None, "this_cycle", None, None)),
        ("Tháng này tiêu bao nhiêu?", ("sum", None, None, "this_cycle", None, None)),
        ("tháng trước tôi tiêu bao nhiêu", ("sum", None, None, "last_cycle", None, None)),
        ("thu nhập tháng này", ("sum", None, "income", "this_cycle", None, None)),
        ("đã chi những khoản nào hôm nay", ("top_n", None, None, "custom", TODAY, TODAY)),
        ("liệt kê các khoản chi tuần này", ("top_n", None, None, "this_week", None, None)),
        ("Còn bao nhiêu ngân sách?", ("budget_status", None, None, "this_cycle", None, None)),
        ("ngân sách tháng này còn lại bao nhiêu", ("budget_status", None, None, "this_cycle", None, None)),
    ],
)
def test_totals_lists_and_budgets(text: str, expected: tuple) -> None:
    assert _shape(text) == expected


# Typing a starter chip's label reaches the very question the chip sends
# (mobile starter-chips.ts, backend starterChips()).
@pytest.mark.parametrize(
    ("label", "expected"),
    [
        ("Tháng này tiêu bao nhiêu?", ("sum", None, None, "this_cycle", None, None)),
        ("Tiền đi đâu?", ("breakdown", "category", None, "this_cycle", None, None)),
        ("Còn bao nhiêu ngân sách?", ("budget_status", None, None, "this_cycle", None, None)),
        ("Thu nhập tháng này", ("sum", None, "income", "this_cycle", None, None)),
    ],
)
def test_typed_starter_chips_match_the_chips(label: str, expected: tuple) -> None:
    assert _shape(label) == expected


# One word the table does not know, and the model reads the question: these
# carry a condition (a Category, a part of the day, a place, an evaluation, a
# comparison) or lean on an earlier question.
@pytest.mark.parametrize(
    "text",
    [
        "ăn uống hôm nay tiêu bao nhiêu",
        "sáng nay tiêu gì",
        "tối qua chi gì",
        "tháng này tiêu nhiều không",
        "hôm nay so với hôm qua",
        "tiêu ở đâu nhiều nhất",
        "ví nào tiêu nhiều nhất",
        "tiêu cho con bao nhiêu",
        "cafe 50k",
        "ăn trưa 35k",
        "đi đâu hôm nay",
        "danh mục nào",
        "thế còn tháng trước",
        "còn tháng trước?",
        "hôm nay",
        "khoản nào nhiều nhất",
        "ngân sách tháng trước còn bao nhiêu",
        "tháng này bao nhiêu tiền",
        "6 tháng qua tiêu thế nào theo từng tháng",
        "các khoản chi trên 1 triệu tuần này",
        "thu nhập tháng này tiêu gì",
        "hôm nay hôm qua tiêu gì",
        "nên đầu tư gì",
    ],
)
def test_anything_unknown_goes_to_the_model(text: str) -> None:
    assert _read(text) is None


def test_bad_today_goes_to_the_model() -> None:
    assert read_simple_question("tieu hom nay", "not-a-date") is None


def _golden_rows() -> list[dict]:
    return [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]


def _as_response(text: str) -> ConsultResponse | None:
    q = _read(text)
    if q is None:
        return None
    return ConsultResponse(kind="query", coverage="full", query=q, normalized_text="", usage=ConsultUsage(), method="regex")


def test_rules_agree_with_every_golden_row_they_read() -> None:
    """The golden set is labelled for the model; wherever the rules answer
    instead, they must give the labelled answer — and must never answer a
    row labelled not answerable (spec.md S-AIQ-27)."""
    read = 0
    for row in _golden_rows():
        resp = _as_response(row["text"])
        if resp is None:
            continue
        read += 1
        assert _matches(row["expected"], resp), f"{row['text']!r}: {resp.query}"
    assert read >= 20


def test_rules_read_every_what_spent_golden_row() -> None:
    rows = [r for r in _golden_rows() if r["group"] == "what_spent"]
    assert rows and all(_as_response(r["text"]) is not None for r in rows)


def _request(message: str) -> ConsultRequest:
    return ConsultRequest(message=message, categories=CATEGORIES, wallets=WALLETS, today=TODAY, timezone="Asia/Ho_Chi_Minh")


def test_consult_reads_rule_questions_without_the_model(monkeypatch) -> None:
    from app.services import consult_service

    def no_model(*_args: object) -> None:
        raise AssertionError("the model must not be called")

    monkeypatch.setattr(consult_service, "_call_groq", no_model)
    resp = asyncio.run(consult_service.consult(_request("danh mục tiêu hnay")))
    assert resp.method == "regex" and resp.kind == "query" and resp.coverage == "full"
    assert (resp.query.metric, resp.query.group_by, resp.query.from_) == ("breakdown", "category", TODAY)
    assert resp.usage.prompt_tokens == 0
    assert resp.model_dump(by_alias=True)["query"]["from"] == TODAY


def test_consult_sends_other_questions_to_the_model(monkeypatch) -> None:
    from app.services import consult_service

    calls = []

    def model(system_prompt: str, user_message: str):
        calls.append(user_message)
        out = ConsultToolOutput(kind="query", coverage="partial", metric="sum", period="custom", from_date=TODAY, to_date=TODAY)
        return out, ConsultUsage(prompt_tokens=1800, completion_tokens=40)

    monkeypatch.setattr(consult_service, "_call_groq", model)
    resp = asyncio.run(consult_service.consult(_request("sáng nay tiêu gì")))
    assert calls and resp.method == "llm" and resp.coverage == "partial"
