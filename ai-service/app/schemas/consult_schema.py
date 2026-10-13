"""Pydantic schemas for POST /consult — interpreting one free-text spending
question into a structured question (specs/ai-chat-query-spending/plan.md
AIQ-T31). The Go backend computes every figure; nothing here carries money
except a parsed threshold.

ConsultToolOutput is the forced tool's schema and is deliberately FLAT — no
nested models, so no $defs/$ref — because gpt-oss models mishandle nested
schemas under forced tool_choice (see extract_service._dereference_schema).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ParseKind = Literal["query", "evaluate", "scenario", "unsupported", "needs_context", "transaction_like"]
Coverage = Literal["full", "partial"]
Metric = Literal["sum", "breakdown", "compare", "series", "top_n", "max_tx", "avg_daily", "budget_status"]
GroupBy = Literal["category", "wallet", "weekday"]
TxType = Literal["income", "expense"]
Period = Literal["this_cycle", "last_cycle", "last_3_cycles", "last_6_cycles", "last_30_days", "this_week", "custom"]

MESSAGE_MAX_LENGTH = 300
LIST_MAX_ROWS = 10


class ConsultCategory(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    type: str


class ConsultWallet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    currency: str
    is_default: bool


class ConsultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=MESSAGE_MAX_LENGTH)
    categories: list[ConsultCategory]
    wallets: list[ConsultWallet]
    today: str
    timezone: str


class ConsultToolOutput(BaseModel):
    """What the model must return. Every field it may leave out is nullable."""

    model_config = ConfigDict(extra="forbid")

    kind: ParseKind
    coverage: Coverage = Field(description="full only if EVERY condition in the question is represented below")
    metric: Metric | None = None
    group_by: GroupBy | None = None
    tx_type: TxType | None = None
    period: Period | None = None
    from_date: str | None = Field(default=None, description="YYYY-MM-DD, only for period=custom")
    to_date: str | None = Field(default=None, description="YYYY-MM-DD, only for period=custom")
    category_ids: list[str] = Field(default_factory=list, description="ids copied exactly from the Category list")
    wallet_id: str | None = Field(default=None, description="id copied exactly from the Wallet list")
    amount_min_vnd: int | None = Field(default=None, ge=1, description="threshold in dong, e.g. 50000 for 50k")
    limit: int | None = Field(default=None, ge=1, le=LIST_MAX_ROWS)
    category_confidence: float | None = Field(default=None, ge=0, le=1)
    goal_amount_vnd: int | None = Field(default=None, ge=1, description="scenario only: target amount in dong, e.g. 30000000 for 30tr")
    goal_deadline: str | None = Field(default=None, description="scenario only: YYYY-MM-DD the money is needed by")
    monthly_save_vnd: int | None = Field(default=None, ge=1, description="scenario only: amount the User says they save per month, in dong")


class ConsultQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    metric: Metric
    group_by: GroupBy | None = None
    tx_type: TxType | None = None
    period: Period
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    category_ids: list[str] = Field(default_factory=list)
    wallet_id: str | None = None
    amount_min_vnd: int | None = None
    limit: int | None = None


class ConsultScenario(BaseModel):
    """A savings goal: reach goal_amount_vnd by goal_deadline, or by saving
    monthly_save_vnd a month. The backend does all the arithmetic."""

    model_config = ConfigDict(extra="forbid")

    goal_amount_vnd: int
    goal_deadline: str | None = None
    monthly_save_vnd: int | None = None


class ConsultUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_tokens: int = 0


class ConsultResponse(BaseModel):
    kind: ParseKind
    coverage: Coverage
    query: ConsultQuery | None = None
    # Set only for kind="scenario" when the question is a savings goal;
    # other what-ifs (cutting a Category) still have no scenario.
    scenario: ConsultScenario | None = None
    category_confidence: float | None = None
    normalized_text: str
    usage: ConsultUsage
    # True when the model answered but its output did not fit the catalog —
    # the backend replies "unsupported" and logs an error, never "degraded".
    invalid_output: bool = False
    # "regex" when the phrase rules read the question (app/nlu/intent_rules.py)
    # and no model was called; the backend logs it as the question's method.
    method: Literal["llm", "regex"] = "llm"
