package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// cursorPayload is the opaque pagination cursor's decoded shape (plan.md
// Edge Case #1 for US-03: "{id, created_at} of the last item, base64 encoded").
type cursorPayload struct {
	ID        uuid.UUID `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

func encodeCursor(id uuid.UUID, createdAt time.Time) (string, error) {
	raw, err := json.Marshal(cursorPayload{ID: id, CreatedAt: createdAt})
	if err != nil {
		return "", fmt.Errorf("service.encodeCursor: %w", err)
	}
	return base64.URLEncoding.EncodeToString(raw), nil
}

func decodeCursor(cursor string) (uuid.UUID, time.Time, error) {
	raw, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return uuid.UUID{}, time.Time{}, fmt.Errorf("service.decodeCursor: %w", err)
	}
	var payload cursorPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return uuid.UUID{}, time.Time{}, fmt.Errorf("service.decodeCursor: %w", err)
	}
	return payload.ID, payload.CreatedAt, nil
}

// transactionCursorPayload is a second, additive cursor shape keyed
// {id, occurred_at, created_at} rather than {id, created_at} —
// specs/transaction-management/plan.md Finding #5. A Transaction's natural
// sort is "when the money moved," not "when the row was inserted"
// (specs/transaction-management/spec.md Edge Cases US-02 #1), so this cannot
// reuse cursorPayload above without misrepresenting a backdated Transaction's
// position in the list. CreatedAt was added as the tie-break for two
// Transactions occurring at the same instant (or same day, prior to any
// created_at tie-break at all) — "the actual moment the user approved it" —
// with id remaining the final tie-break for equal created_at.
// UserService.ListUsers's existing cursorPayload/encodeCursor/decodeCursor
// are untouched by this addition.
type transactionCursorPayload struct {
	ID         uuid.UUID `json:"id"`
	OccurredAt time.Time `json:"occurred_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func encodeTransactionCursor(id uuid.UUID, occurredAt, createdAt time.Time) (string, error) {
	raw, err := json.Marshal(transactionCursorPayload{ID: id, OccurredAt: occurredAt, CreatedAt: createdAt})
	if err != nil {
		return "", fmt.Errorf("service.encodeTransactionCursor: %w", err)
	}
	return base64.URLEncoding.EncodeToString(raw), nil
}

func decodeTransactionCursor(cursor string) (uuid.UUID, time.Time, time.Time, error) {
	raw, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return uuid.UUID{}, time.Time{}, time.Time{}, fmt.Errorf("service.decodeTransactionCursor: %w", err)
	}
	var payload transactionCursorPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return uuid.UUID{}, time.Time{}, time.Time{}, fmt.Errorf("service.decodeTransactionCursor: %w", err)
	}
	return payload.ID, payload.OccurredAt, payload.CreatedAt, nil
}
