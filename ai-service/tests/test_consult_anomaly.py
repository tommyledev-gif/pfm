"""Offline tests for "anything unusual?" questions (backend metric anomaly):
the phrase rules that read them without a model call, the tool schema and
prompt that route the rest, and the golden rows they must agree with."""

import asyncio
import json

import pytest

from app.nlu.intent_rules import read_simple_question
from app.nlu.normalize import normalize
from app.schemas.consult_schema import ConsultRequest, ConsultToolOutput, ConsultUsage
from app.services.consult_prompt import build_consult_prompt
from app.services.consult_service import to_response
from tests.test_consult_golden import CATEGORIES, GOLDEN, GOLDEN_TODAY, WALLETS

TODAY = GOLDEN_TODAY  # 2026-10-14
YESTERDAY = "2026-10-13"


def _read(text: str):
    return read_simple_question(normalize(text), TODAY)


def _shape(text: str) -> tuple:
    q = _read(text)
    assert q is not None, f"{text!r} should be read by the phrase rules"
    return (q.metric, q.group_by, q.tx_type, q.period, q.from_, q.to)


TODAY_ANOMALY = ("anomaly", None, None, "custom", TODAY, TODAY)


# No period stated means today, in every spelling: accents or not, "j" for
# "gì", "k"/"ko" for "không", "hnay", "bth" for "bình thường".
@pytest.mark.parametrize(
    "text",
    [
        "có j bất thường hnay",
        "co gi bat thuong hom nay",
        "Có gì bất thường không?",
        "hnay có gì lạ k",
        "bất thường",
        "chi nhiều bất thường",
        "có khoản chi nào bất thường không",
        "có giao dịch nào lạ không",
        "hôm nay tiêu nhiều hơn bth k",
        "nay có gì khác thường",
    ],
)
def test_anything_unusual_defaults_to_today(text: str) -> None:
    assert _shape(text) == TODAY_ANOMALY


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("hôm qua có khoản nào bất thường không", ("anomaly", None, None, "custom", YESTERDAY, YESTERDAY)),
        ("hqua tiêu gì lạ", ("anomaly", None, None, "custom", YESTERDAY, YESTERDAY)),
        ("hôm kia có gì bất thường ko", ("anomaly", None, None, "custom", "2026-10-12", "2026-10-12")),
        ("tuần này có gì lạ không", ("anomaly", None, None, "this_week", None, None)),
        ("tuần này chi tiêu có đột biến không", ("anomaly", None, None, "this_week", None, None)),
        ("tháng này danh mục nào tăng đột biến", ("anomaly", None, None, "this_cycle", None, None)),
        ("tháng này tiêu nhiều hơn bình thường không", ("anomaly", None, None, "this_cycle", None, None)),
        ("tháng trước có gì khác thường", ("anomaly", None, None, "last_cycle", None, None)),
    ],
)
def test_anything_unusual_over_a_stated_period(text: str, expected: tuple) -> None:
    assert _shape(text) == expected


# The model reads these: a Category, income, "the most", a period the
# backend cannot compare, or a yes/no question that is an evaluation.
@pytest.mark.parametrize(
    "text",
    [
        "ăn uống hôm nay có gì lạ",
        "thu nhập có gì lạ",
        "dạo này có gì bất thường",
        "3 tháng qua có gì bất thường",
        "tiêu gì là nhiều nhất",
        "ngân sách có gì bất thường",
        "hôm nay có gì",
        "tháng này có tiêu nhiều không",
        "có tiêu bao nhiêu",
        "hôm nay hôm qua có gì lạ",
    ],
)
def test_unusual_outside_the_table_goes_to_the_model(text: str) -> None:
    assert _read(text) is None


# "là" and "lạ" are both "la" once unaccented: a bare "la" is never the cue.
def test_bare_la_is_not_unusual() -> None:
    assert _shape("chi tiêu là bao nhiêu hôm nay") == ("sum", None, None, "custom", TODAY, TODAY)


def test_rules_read_every_anomaly_golden_row_without_a_category() -> None:
    rows = [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]
    rows = [r for r in rows if r["group"] == "anomaly"]
    readable = [r for r in rows if r["expected"]["kind"] == "query" and r["expected"]["period"] != "last_30_days" and not r["expected"].get("category_names")]
    assert len(readable) >= 12
    for r in readable:
        q = _read(r["text"])
        assert q is not None and q.metric == "anomaly" and q.period == r["expected"]["period"], r["text"]
        assert q.from_ == r["expected"].get("from") and q.to == r["expected"].get("to"), r["text"]


def _request(message: str) -> ConsultRequest:
    return ConsultRequest(message=message, categories=CATEGORIES, wallets=WALLETS, today=TODAY, timezone="Asia/Ho_Chi_Minh")


def test_consult_reads_the_owner_example_without_the_model(monkeypatch) -> None:
    from app.services import consult_service

    def no_model(*_args: object) -> None:
        raise AssertionError("the model must not be called")

    monkeypatch.setattr(consult_service, "_call_groq", no_model)
    resp = asyncio.run(consult_service.consult(_request("có j bất thường hnay")))
    body = resp.model_dump(by_alias=True)
    assert resp.method == "regex" and resp.kind == "query" and resp.coverage == "full"
    assert body["query"]["metric"] == "anomaly" and body["query"]["from"] == TODAY and body["query"]["to"] == TODAY
    assert resp.usage.prompt_tokens == 0


def test_anomaly_is_a_tool_metric_and_maps_through() -> None:
    schema = json.dumps(ConsultToolOutput.model_json_schema())
    assert '"anomaly"' in schema
    out = ConsultToolOutput(
        kind="query", coverage="full", metric="anomaly", period="custom", from_date=YESTERDAY, to_date=YESTERDAY,
        category_ids=[CATEGORIES[0].id], category_confidence=0.95,
    )
    resp = to_response(out, _request("hôm qua ăn uống có gì lạ"), "hom qua an uong co gi la", ConsultUsage())
    assert resp.coverage == "full" and resp.query.metric == "anomaly"
    assert (resp.query.from_, resp.query.to, resp.query.category_ids) == (YESTERDAY, YESTERDAY, [CATEGORIES[0].id])


def test_prompt_routes_unusual_questions_to_anomaly() -> None:
    prompt = build_consult_prompt(CATEGORIES, WALLETS, TODAY, "Asia/Ho_Chi_Minh")
    unsupported = next(line for line in prompt.splitlines() if line.startswith('- "unsupported"'))
    assert "bất thường" not in unsupported
    assert "- anomaly:" in prompt and "riêng anomaly: hôm nay" in prompt
