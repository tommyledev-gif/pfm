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


class ExtractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
    wallets: list[WalletContext]
    categories: list[CategoryContext]
    now: str  # RFC3339, UTC — the Go Backend's server time, never client-supplied


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
    note: str | None = None
    occurred_at: str  # YYYY-MM-DD
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Literal["create_transaction", "ambiguous"]
    transactions: list[ProposedTransaction] = Field(default_factory=list)
