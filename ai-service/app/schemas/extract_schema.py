"""Pydantic v2 request/response schemas for POST /extract.

Field-for-field mirror of the Go Backend's wire types
(backend/internal/service/ai_service_client.go's aiWireRequest/aiWireResponse)
— keep the two in sync by hand if either side changes
(specs/ai-chat-assistant/spec.md Preconditions).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WalletContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    is_default: bool
    currency: str


class CategoryContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    type: str


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str


class ExtractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
    # Prior turns in the same conversation, oldest first, never including
    # `message` itself — lets the model disambiguate a short follow-up (e.g.
    # "20k" after "mua cà phê") using what was already said instead of
    # judging it in isolation. Empty for a brand-new conversation.
    history: list[ChatTurn] = Field(default_factory=list)
    wallets: list[WalletContext]
    categories: list[CategoryContext]
    now: str  # RFC3339, UTC — the Go Backend's server time, never client-supplied


class ProposedItem(BaseModel):
    """One line of a single purchase (specs/transaction-line-items). Whole VND,
    integers only — the Go Backend converts to xu and recomputes the total."""

    model_config = ConfigDict(extra="forbid")

    # These descriptions reach the model inside the forced tool schema
    # (extract_service._extract_tool_schema), which it follows more reliably
    # than prose in the system prompt. Names polluted with the price and a
    # remark ("sữa đặc 22k của duy") were observed live; the price part that
    # still slips through is stripped by app/services/item_names.py.
    name: str = Field(
        description=(
            "Product name only, in the user's words (keep brand, color, size such as 500ml). "
            "Never include a price or amount (35k, 22k, 1tr2, 35.000, 35000đ) or a count "
            '(x2, the 2 in "2 trà đá"): the count goes in quantity, prices go in unit_price_vnd '
            'and amount_vnd. A remark about whose it is or who it is for ("của duy", "cho mẹ") '
            "is not part of the name: append it to the transaction note instead. "
            'Example: "sữa đặc 22k của duy" gives name "sữa đặc".'
        )
    )
    quantity: int = Field(default=1, ge=1, description="How many were bought; 1 when the user gave no count.")
    unit_price_vnd: int | None = Field(
        default=None,
        description="Price of one unit in whole VND, only when the user stated a per-unit price; otherwise null.",
    )
    amount_vnd: int = Field(description="Line total of this item in whole VND.")


class ProposedTransaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_vnd: int
    tx_type: Literal["income", "expense"]
    # category_id/wallet_id are untrusted, unvalidated strings from the LLM's
    # own output — the Go Backend re-validates ownership before ever using
    # them (specs/ai-chat-assistant/spec.md Resolved design decision #4).
    # This service never asserts they are valid UUIDs or that they belong to
    # the caller; that is explicitly not this service's job.
    category_id: str
    wallet_id: str | None = None
    note: str | None = Field(
        default=None,
        description=(
            "Short note in the user's words: what was bought, where, with or for whom. "
            "When the purchase has items, also append any remark the user attached to one item, "
            'together with that item\'s name ("sữa đặc của duy"), since item names hold the product only.'
        ),
    )
    occurred_at: str  # YYYY-MM-DD
    confidence: float = Field(ge=0.0, le=1.0)
    # Filled only when one purchase lists several things bought together;
    # empty for an ordinary single expense or income.
    items: list[ProposedItem] = Field(default_factory=list)


class ExtractResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # "budget_wizard" backs specs/ai-budget-wizard/spec.md US-02 — mutually
    # exclusive with "create_transaction" for the same message (Edge Cases
    # #3): when intent is "budget_wizard", transactions is always empty.
    intent: Literal["create_transaction", "ambiguous", "budget_wizard"]
    transactions: list[ProposedTransaction] = Field(default_factory=list)
