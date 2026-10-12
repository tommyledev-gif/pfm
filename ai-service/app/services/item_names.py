"""Deterministic clean-up of item names after /extract parses the tool call
(specs/transaction-line-items, typed chat).

The prompt and the tool schema both tell the model to keep prices out of an
item's name, but "sữa đặc 22k của duy, khăn giấy 18k" was observed coming
back with names "sữa đặc 22k của duy" and "khăn giấy 18k". This is the safety
net for what slips through: it removes only price tokens and quantity
markers, which are unambiguous. Moving a remark ("của duy") into the note
stays the model's job; which words are a remark is not a regex decision.
"""

import re
import unicodedata

from app.schemas.extract_schema import ExtractResponse

# 35k, 22K, 1.5k, 1tr2, 1.5tr, 2 triệu, 50 nghìn, 35.000đ, 30.000 VND, and a
# per-unit form ("15k/lon"). The unit must end the word, so "5kg" and "500ml"
# stay, and a digit glued to letters before it ("S24", "A4") is not a price.
_PRICE_WITH_UNIT = re.compile(
    r"(?<![\w.,])\d+(?:[.,]\d+)*\s*"
    r"(?:k|nghìn|nghin|ngàn|ngan|ngìn|tr(?:iệu|ieu)?\d*|đồng|vnđ|vnd|đ)"
    r"(?:\s*/\s*[^\W\d_]+)?(?!\w)",
    re.IGNORECASE,
)
# Bare amounts: 35000, 35.000, 1.500.000, optionally followed by a currency.
# Four digits or more only: shorter bare numbers ("bia 333") belong to the
# name. Plain "d" is accepted here only, so "kính 3D" keeps its "3D".
_BARE_AMOUNT = re.compile(
    r"(?<![\w.,])(?:\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:\s*(?:đồng|vnđ|vnd|đ|d))?(?!\w)",
    re.IGNORECASE,
)
# x2, X 2, ×2, × 2: a count that belongs in `quantity`.
_QUANTITY_MARKER = re.compile(r"(?<!\w)[x×]\s*\d+(?!\w)", re.IGNORECASE)

_TOKENS = (_PRICE_WITH_UNIT, _BARE_AMOUNT, _QUANTITY_MARKER)

_EMPTY_BRACKETS = re.compile(r"\(\s*\)|\[\s*\]")
_WHITESPACE = re.compile(r"\s+")
_SPACE_BEFORE_PUNCT = re.compile(r"\s+([,.;:)\]])")
_REPEATED_SEPARATORS = re.compile(r"([,;:/@\-–])(?:\s*[,;:/@\-–])+")
_EDGE_PUNCT = " ,.;:/@-–"


def clean_item_name(name: str) -> str:
    """Returns `name` without price tokens or quantity markers.

    A name with nothing to strip comes back unchanged. A name that would end
    up with no letter or digit left (the model put only a price there) also
    comes back unchanged: an empty item name is worse than a noisy one.
    """
    text = unicodedata.normalize("NFC", name)
    stripped = text
    for pattern in _TOKENS:
        stripped = pattern.sub(" ", stripped)
    if stripped == text:
        return name

    cleaned = _EMPTY_BRACKETS.sub(" ", stripped)
    cleaned = _WHITESPACE.sub(" ", cleaned)
    cleaned = _SPACE_BEFORE_PUNCT.sub(r"\1", cleaned)
    cleaned = _REPEATED_SEPARATORS.sub(r"\1", cleaned)
    cleaned = cleaned.strip(_EDGE_PUNCT)
    if not any(ch.isalnum() for ch in cleaned):
        return name
    return cleaned


def clean_item_names(response: ExtractResponse) -> ExtractResponse:
    """Applies clean_item_name to every item of every proposed transaction,
    in place, and returns the same response."""
    for transaction in response.transactions:
        for item in transaction.items:
            item.name = clean_item_name(item.name)
    return response
