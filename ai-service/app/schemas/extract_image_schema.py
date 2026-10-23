"""Pydantic v2 schemas for POST /extract-image (specs/ai-chat-image-capture
plan §3.3, §4.3).

Field-for-field mirror of the Go Backend's wire types
(backend/internal/service/ai_image_client.go) — keep the two in sync by hand.
Amounts are whole VND integers, never xu (plan F2): asking the model for ×100
values re-introduces the 100× error class seen in live testing. StrictInt
makes a fractional amount fail validation instead of being rounded (spec
BR-02); image_reading.parse_image_reading drops that one entry and counts it.

The `description` strings reach the model inside the forced tool schema,
which it follows more reliably than prose in the system prompt.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from app.schemas.extract_schema import CategoryContext, WalletContext
from app.schemas.limits import (
    CAPTION_MAX_CHARS,
    CATEGORIES_MAX,
    IMAGE_BASE64_MAX_CHARS,
    IMAGE_MAX_ITEMS,
    SHORT_FIELD_MAX_CHARS,
    WALLETS_MAX,
)

# A longer note is cut by image_reading.parse_image_reading before validation,
# so it never costs the User the whole entry.
NOTE_MAX_LENGTH = 200


class ExtractImageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(min_length=1, max_length=IMAGE_BASE64_MAX_CHARS)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    caption: str | None = Field(default=None, max_length=CAPTION_MAX_CHARS)
    wallets: list[WalletContext] = Field(max_length=WALLETS_MAX)
    categories: list[CategoryContext] = Field(max_length=CATEGORIES_MAX)
    # RFC3339, UTC — the Go Backend's server time, never client-supplied
    now: str = Field(max_length=SHORT_FIELD_MAX_CHARS)
    max_items: int = Field(ge=1, le=IMAGE_MAX_ITEMS)
    # False when Phase 0 failed the receipt-line criteria (plan §2.4,
    # AIImageReadReceiptLines): the prompt then never asks for lines.
    read_lines: bool = True


class ProposedImageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        description=(
            "Product name as printed on the receipt. A weight or size stays in the name "
            '("HANH TAY DA LAT 0.334kg"). Never a price.'
        ),
    )
    quantity: StrictInt = Field(
        ge=1,
        description="Whole number of units. Weighed goods or a fractional quantity: 1, with the weight in the name.",
    )
    unit_price_vnd: StrictInt | None = Field(
        default=None,
        gt=0,
        description="Printed price of one unit in whole VND, only when quantity is above 1; otherwise null.",
    )
    amount_vnd: StrictInt = Field(gt=0, description="Printed line amount of this item in whole VND.")
    needs_review: bool = Field(
        default=False,
        description="True only when this line's digits or name are blurred, cut off or ambiguous.",
    )


class ProposedImageAdjustment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["tax", "fee", "discount", "other"] = Field(
        description="tax: VAT not already included in prices. fee: service, delivery, packaging. discount: any discount, promotion or voucher."
    )
    direction: Literal["add", "subtract"] = Field(description="add for tax and fee, subtract for discount.")
    label: str | None = Field(default=None, description="The line's printed label, short.")
    amount_vnd: StrictInt = Field(gt=0, description="Always positive whole VND, even when printed as a negative number.")
    needs_review: bool = Field(
        default=False,
        description="True only when this line's digits or label are blurred, cut off or ambiguous.",
    )


class ProposedImageTransaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_vnd: StrictInt = Field(
        gt=0,
        description="Whole VND. For a receipt: the final amount payable after every discount, tax and fee.",
    )
    tx_type: Literal["income", "expense"]
    # Untrusted strings from the model — the Go Backend re-validates ownership
    # and type before using them (spec BR-07, BR-20).
    category_id: str = Field(description="Id from the matching expense or income category list.")
    wallet_id: str | None = Field(default=None, description="Id of the wallet named in the caption; otherwise null.")
    note: str | None = Field(
        default=None,
        max_length=NOTE_MAX_LENGTH,
        description="Short: shop name for a receipt, the entry's own words for a note or sheet row.",
    )
    occurred_at: str | None = Field(
        default=None,
        description="Date shown in the image as YYYY-MM-DD (DD/MM order). Null when no date is visible.",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    # Asked as a plain yes/no: Phase 0 showed the model keeps confidence high
    # on a receipt whose total line is cut off (spec EC-37, plan F49).
    total_visible: bool = Field(
        default=True,
        description="Receipt only: true only when the final amount-payable line and its number are fully visible. False when cut off, folded or unreadable. True for notes and sheets.",
    )
    items: list[ProposedImageItem] = Field(
        default_factory=list, description="Receipt only: the product lines bought. Empty for notes and sheets."
    )
    adjustments: list[ProposedImageAdjustment] = Field(
        default_factory=list, description="Receipt only: tax, fee and discount lines. Empty for notes and sheets."
    )


class ImageReading(BaseModel):
    """Arguments of the forced `record_transactions` tool call."""

    model_config = ConfigDict(extra="forbid")

    intent: Literal["create_transaction", "no_transactions"]
    source_kind: Literal["receipt", "handwritten", "spreadsheet", "other"]
    transactions: list[ProposedImageTransaction] = Field(default_factory=list)
    unread_count: int = Field(
        default=0,
        ge=0,
        description="Entries seen but not proposed: unreadable, another currency, or a fractional amount.",
    )
    truncated: bool = Field(default=False, description="True when entries beyond the maximum were left out.")


class ExtractImageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Literal["create_transaction", "no_transactions"]
    source_kind: Literal["receipt", "handwritten", "spreadsheet", "other"]
    transactions: list[ProposedImageTransaction] = Field(default_factory=list)
    # unread (reported by the model) + invalid (dropped by validation here).
    unread_count: int = 0
    truncated: bool = False


def require_every_field(schema: dict) -> dict:
    """Marks every property of every object in a (dereferenced) tool schema as
    required. Phase 0 showed the model silently omits optional keys —
    `adjustments` never appeared while it was optional. Parsing stays
    tolerant: the Pydantic defaults still apply to anything missing."""
    if isinstance(schema, dict):
        out = {k: require_every_field(v) for k, v in schema.items()}
        if isinstance(out.get("properties"), dict):
            out["required"] = list(out["properties"].keys())
        return out
    if isinstance(schema, list):
        return [require_every_field(v) for v in schema]
    return schema


class ExtractImageBusyResponse(BaseModel):
    """Body of the 429 returned when the provider is out of capacity (plan F34)."""

    retry_after_seconds: int | None = None
