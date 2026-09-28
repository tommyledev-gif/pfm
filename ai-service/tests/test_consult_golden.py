"""Golden-set evaluation of free-text interpretation against the real
provider (plan.md AIQ-T36). Opt-in: costs tokens and needs network.

    PFM_LIVE_LLM=1 GROQ_API_KEY=... python -m pytest -m live -s

⚠️ Use a key from a separate Groq org, never production's: the limit is per
org, so a run would degrade production questions and recording for its whole
length (plan.md R-F27). Calls are paced to fit the free tier (about 2k tokens
each against 8k per minute); expect roughly half an hour for the full set.

Asserts the structured question only — never wording. Reports per-group
accuracy and fails on any partial-understanding answer (spec.md S-AIQ-27):
a question labelled unsupported/partial must never come back as a full
query.
"""

import asyncio
import json
import os
import time
from collections import defaultdict
from pathlib import Path

import pytest

from app.schemas.consult_schema import ConsultCategory, ConsultRequest, ConsultWallet
from app.services.consult_service import ConsultUnavailableError, consult

GOLDEN = Path(__file__).parent / "golden" / "analytics_intents.jsonl"
CATEGORIES = [
    ConsultCategory(id=f"00000000-0000-4000-8000-{i:012d}", name=name, type=kind)
    for i, (name, kind) in enumerate(
        [
            ("Ăn uống", "expense"), ("Cà phê", "expense"), ("Di chuyển", "expense"), ("Mua sắm", "expense"),
            ("Nhà ở", "expense"), ("Hoá đơn", "expense"), ("Giải trí", "expense"), ("Sức khoẻ", "expense"),
            ("Lương", "income"), ("Thưởng", "income"),
        ]
    )
]
NAME_TO_ID = {c.name: c.id for c in CATEGORIES}
WALLETS = [
    ConsultWallet(id="00000000-0000-4000-9000-000000000001", name="Tiền mặt", currency="VND", is_default=True),
    ConsultWallet(id="00000000-0000-4000-9000-000000000002", name="Techcombank", currency="VND", is_default=False),
]

pytestmark = pytest.mark.live

GOLDEN_TODAY = "2026-10-14"
# Seconds between calls, and the wait after a rate-limited call.
PACE_SECONDS = float(os.environ.get("PFM_LIVE_PACE_SECONDS", "15"))
RATE_LIMIT_BACKOFF_SECONDS = 30
RATE_LIMIT_RETRIES = 3


def _matches(expected: dict, resp) -> bool:
    if resp.kind != expected["kind"]:
        return False
    if expected["kind"] != "query":
        return True
    if resp.coverage != expected["coverage"]:
        return False
    if expected["coverage"] != "full":
        return True
    q = resp.query
    checks = [
        q.metric == expected["metric"],
        q.period == expected["period"],
        (q.group_by or None) == expected.get("group_by"),
        (q.tx_type or "expense") == expected.get("tx_type", "expense"),
        sorted(q.category_ids) == sorted(NAME_TO_ID[n] for n in expected.get("category_names", [])),
        q.amount_min_vnd == expected.get("amount_min_vnd"),
        # Single-day rows name the exact day (plan.md R-F24); others do not.
        "from" not in expected or q.from_ == expected["from"],
        "to" not in expected or q.to == expected["to"],
    ]
    return all(checks)


@pytest.mark.skipif(os.environ.get("PFM_LIVE_LLM") != "1", reason="live provider evaluation is opt-in")
def test_golden_set() -> None:
    rows = [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 100

    per_group: dict[str, list[bool]] = defaultdict(list)
    partial_answers = []
    for row in rows:
        req = ConsultRequest(message=row["text"], categories=CATEGORIES, wallets=WALLETS, today=GOLDEN_TODAY, timezone="Asia/Ho_Chi_Minh")
        resp = _consult_paced(req)
        per_group[row["group"]].append(_matches(row["expected"], resp))
        not_answerable = row["expected"]["kind"] != "query" or row["expected"].get("coverage") == "partial"
        if not_answerable and resp.kind == "query" and resp.coverage == "full":
            partial_answers.append(row["text"])

    for group, results in sorted(per_group.items()):
        print(f"{group:20s} {sum(results):3d}/{len(results):3d}")
    assert not partial_answers, f"answered questions that must not be answered: {partial_answers}"


def _consult_paced(req: ConsultRequest):
    """One call, paced and retried on a provider outage (in practice a 429 on
    the free tier), so a rate limit is waited out rather than scored as a
    wrong interpretation."""
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        time.sleep(PACE_SECONDS)
        try:
            return asyncio.run(consult(req))
        except ConsultUnavailableError:
            if attempt == RATE_LIMIT_RETRIES:
                raise
            time.sleep(RATE_LIMIT_BACKOFF_SECONDS)
    raise AssertionError("unreachable")
