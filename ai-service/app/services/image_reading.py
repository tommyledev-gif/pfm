"""Turns the model's raw tool-call arguments into an ExtractImageResponse
(specs/ai-chat-image-capture plan §3.4, F25). Pure — no I/O.

Each transaction is validated on its own: one entry with a fractional amount
(spec BR-02) or a malformed field is dropped and counted as unread, instead
of failing the whole reading. Only a broken envelope (intent, source_kind)
fails the reading — that is treated like any provider failure.
"""

from pydantic import ValidationError

from app.schemas.extract_image_schema import NOTE_MAX_LENGTH, ExtractImageResponse, ImageReading, ProposedImageTransaction


class InvalidImageReadingError(Exception):
    """The tool-call arguments are not a usable reading at all."""


def parse_image_reading(raw: object, max_items: int) -> ExtractImageResponse:
    if not isinstance(raw, dict):
        raise InvalidImageReadingError("tool arguments are not an object")

    raw_transactions = raw.get("transactions") or []
    if not isinstance(raw_transactions, list):
        raise InvalidImageReadingError("transactions is not a list")

    try:
        envelope = ImageReading.model_validate({**raw, "transactions": []})
    except ValidationError as exc:
        raise InvalidImageReadingError("envelope failed validation") from exc

    kept: list[ProposedImageTransaction] = []
    invalid = 0
    for entry in raw_transactions:
        try:
            kept.append(ProposedImageTransaction.model_validate(_cut_note(entry)))
        except ValidationError:
            invalid += 1

    truncated = envelope.truncated or len(kept) > max_items
    return ExtractImageResponse(
        intent="create_transaction" if kept else "no_transactions",
        source_kind=envelope.source_kind,
        transactions=kept[:max_items],
        unread_count=envelope.unread_count + invalid,
        truncated=truncated,
    )


def _cut_note(entry: object) -> object:
    if isinstance(entry, dict) and isinstance(entry.get("note"), str) and len(entry["note"]) > NOTE_MAX_LENGTH:
        return {**entry, "note": entry["note"][:NOTE_MAX_LENGTH]}
    return entry
