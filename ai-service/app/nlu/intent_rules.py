"""Deterministic reading of the common question shapes, before any model call.

"danh mục tiêu hnay" and "tiền đi đâu hnay" ask the same thing, yet the model
read only the second, and a bare "tiêu hnay" could come back as a Transaction
to record. A short question built only from known phrases (a spend verb, a
"what on" cue, a period, a few filler words) is read here instead: the same
way every time, with no tokens spent.

The rule that keeps this safe: EVERY word must belong to the phrase table.
One word outside it (a Category name, a place, "nhiều không", "sáng nay", a
number of months) and the question goes to the model as before, so this can
only answer a question it understood completely (spec.md S-AIQ-27).

Reads normalize()'s output: lowercase, accentless, teencode expanded. The
question log records these as method "regex" (021_intent_parse_log.sql).
"""

import re
from datetime import date, timedelta

from app.schemas.consult_schema import ConsultQuery

# Longer questions are left to the model: the more words, the likelier one of
# them carries a condition that a phrase table would wave through.
_MAX_WORDS = 12
_PUNCTUATION = re.compile(r"[^\w\s]")

_PHRASES: dict[tuple[str, ...], str] = {}


def _add(role: str, *phrases: str) -> None:
    for phrase in phrases:
        _PHRASES[tuple(phrase.split())] = role


_add("spend", "tieu", "chi", "chi tieu", "tieu xai", "xai", "ton", "mat", "mua", "tieu tien", "chi tien", "xai tien")
_add("money", "tien")
_add("income", "thu nhap", "kiem duoc")
_add("budget", "ngan sach")
_add("remaining", "con", "con lai")
_add("amount", "bao nhieu", "tong", "tong cong")
# "What did the money go on" is one question however it is phrased, and gets
# one answer: the breakdown by Category, which also lists the expenses
# themselves when there are only a few (backend attachInlineRows).
_add("category", "danh muc", "danh muc nao", "nhung danh muc nao", "cac danh muc", "theo danh muc", "moi danh muc", "tung danh muc")
_add(
    "what_on",
    "di dau", "vao dau", "nhung dau", "vao nhung dau",
    "gi", "cai gi", "nhung gi", "nhung cai gi",
    "vao gi", "vao cai gi", "vao nhung gi", "cho gi", "cho cai gi", "cho nhung gi",
)
# Asking for the expenses one by one is the ranked list (spec.md A-06).
_add(
    "list",
    "khoan nao", "nhung khoan nao", "cac khoan", "nhung khoan", "khoan gi", "nhung khoan gi",
    "liet ke", "giao dich nao", "nhung giao dich", "cac giao dich", "nhung giao dich nao",
)
_add("most", "nhieu nhat")
# "Anything unusual?" (backend metric anomaly). Accentless "la" is both "lạ"
# (odd) and "là" (is, a filler), so "lạ" counts only glued to what it
# qualifies: "gì lạ", "khoản lạ". Longest phrase wins, so "khoản nào bất
# thường" is read whole rather than as a list cue.
_add(
    "unusual",
    "bat thuong", "khac thuong", "dot bien", "tang dot bien", "tang vot", "tang manh",
    "nhieu bat thuong", "cao bat thuong", "lon bat thuong",
    "hon binh thuong", "nhieu hon binh thuong", "khac binh thuong", "hon moi khi", "nhieu hon moi khi", "khac moi khi",
    "gi la", "cai gi la", "khoan la", "khoan nao la", "khoan chi la", "giao dich la", "giao dich nao la",
    "khoan bat thuong", "khoan chi bat thuong", "khoan chi nao bat thuong", "giao dich bat thuong",
)
# "có … không" turns a statement into a yes/no question. Known only so an
# unusual-question can be read whole; anywhere else it is an evaluation
# ("tháng này có tiêu nhiều không"), which only the model tells apart.
_add("yes_no", "co", "khong", "co khong", "hay khong", "chua")
_add("filler", "da", "roi", "het", "duoc", "trong", "vay", "nhi", "a", "ha", "oi", "cua", "la", "xem", "coi", "cho xem", "muon biet", "biet")
_add("period:today", "hom nay", "ngay hom nay")
_add("period:yesterday", "hom qua")
_add("period:day_before", "hom kia")
_add("period:this_week", "tuan nay")
_add("period:this_cycle", "thang nay")
_add("period:last_cycle", "thang truoc")
_add("period:last_30_days", "30 ngay qua")

_MAX_PHRASE = max(len(p) for p in _PHRASES)
_DAYS_BACK = {"today": 0, "yesterday": 1, "day_before": 2}
_ANCHORS = {"spend", "money", "income", "category"}
# What an unusual-question may also contain. Not income, budget, a count or
# "most": "thu nhập có gì lạ", "tiêu gì là nhiều nhất" go to the model.
_ANOMALY_ROLES = {"unusual", "spend", "money", "what_on", "category", "list", "filler", "yes_no"}
# The backend compares a day with days, a week with weeks, a cycle with
# cycles; "dạo này" (last 30 days) has nothing to compare with. No period
# stated means today.
_ANOMALY_PERIODS = {None, "today", "yesterday", "day_before", "this_week", "this_cycle", "last_cycle"}


def read_simple_question(normalized: str, today: str) -> ConsultQuery | None:
    """The structured question, or None when the model has to read it."""
    words = _PUNCTUATION.sub(" ", normalized).split()
    if not words or len(words) > _MAX_WORDS:
        return None
    roles = _roles(words)
    if roles is None:
        return None
    periods = [r.removeprefix("period:") for r in roles if r.startswith("period:")]
    if len(periods) > 1:
        return None
    has = {r for r in roles if not r.startswith("period:")}
    period = periods[0] if periods else None
    if "unusual" in has:
        return _anomaly(has, period, today)
    if "yes_no" in has:
        return None
    if "budget" in has:
        return _budget(has, period)
    metric = _metric(has, period)
    if metric is None:
        return None
    return _query(metric, has, period or "this_cycle", today)


def _roles(words: list[str]) -> list[str] | None:
    """Longest phrase first at each position; None at the first unknown word."""
    roles = []
    i = 0
    while i < len(words):
        for n in range(min(_MAX_PHRASE, len(words) - i), 0, -1):
            role = _PHRASES.get(tuple(words[i : i + n]))
            if role:
                roles.append(role)
                i += n
                break
        else:
            return None
    return roles


def _anomaly(has: set[str], period: str | None, today: str) -> ConsultQuery | None:
    """"có j bất thường hnay", "tuần này có khoản nào lạ không"."""
    if has - _ANOMALY_ROLES or period not in _ANOMALY_PERIODS:
        return None
    return _query("anomaly", has, period or "today", today)


def _budget(has: set[str], period: str | None) -> ConsultQuery | None:
    # Budget status is this cycle's only; anything else about budgets is the
    # model's to read.
    if has - {"budget", "remaining", "amount", "filler"} or period not in (None, "this_cycle"):
        return None
    return ConsultQuery(metric="budget_status", period="this_cycle")


def _metric(has: set[str], period: str | None) -> str | None:
    # "còn" outside a budget question leans on the previous one ("thế còn
    # tháng trước?") — needs_context, which only the model tells apart.
    if "remaining" in has or not has & _ANCHORS:
        return None
    if "income" in has and "spend" in has:
        return None
    breakdown = bool(has & {"category", "what_on"})
    listing = "list" in has
    if breakdown and listing:
        return None
    if "most" in has and not breakdown:
        return None  # "khoản nào nhiều nhất" is the single largest: the model's
    if listing:
        return None if "income" in has else "top_n"
    if breakdown:
        # "danh mục" alone with no verb or period asks about Categories, not money.
        if not has & {"spend", "money", "income"} and period is None:
            return None
        return "breakdown"
    return "sum" if has & {"spend", "income"} else None


def _query(metric: str, has: set[str], period: str, today: str) -> ConsultQuery | None:
    day_from = day_to = None
    if period in _DAYS_BACK:
        try:
            day = date.fromisoformat(today) - timedelta(days=_DAYS_BACK[period])
        except ValueError:
            return None
        period, day_from, day_to = "custom", day.isoformat(), day.isoformat()
    return ConsultQuery(
        metric=metric,
        group_by="category" if metric == "breakdown" else None,
        tx_type="income" if "income" in has else None,
        period=period,
        from_=day_from,
        to=day_to,
    )
