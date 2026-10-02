package dto

import (
	"github.com/google/uuid"
)

// CreateTransactionRequest is the body of POST /transactions. OccurredAt is a
// string, not *time.Time — SRS's own example scenarios pass a bare date
// ("2025-12-23"), which Go's encoding/json cannot unmarshal directly into a
// time.Time (it only accepts strict RFC3339). Parsing (RFC3339 first, plain
// date as a fallback) and the "defaults to now" rule both happen in
// TransactionService, not here — same handler/service split precedent as
// dto.CreateBudgetRequest.StartDate, which is also parsed in the service.
// The `max=500` tag necessarily repeats common.TransactionNoteMaxLength as a
// literal — struct tags can't reference a Go const (same DateOnlyLayout
// precedent) — keep the two in sync by hand if this ever changes.
type CreateTransactionRequest struct {
	WalletID uuid.UUID `json:"wallet_id" validate:"required"`
	// CategoryID is ignored for a transfer — the server always assigns the
	// system transfer Category (model.SystemKeyTransfer) — so it is only
	// required for income/expense.
	CategoryID uuid.UUID `json:"category_id" validate:"required_unless=Type transfer"`
	// Integer cents, at most 99_999_999_999_999 (common.MaxTransactionAmountCents;
	// a tag cannot reference the constant, so keep the two in step) — the same
	// ceiling the mobile keypad stops at, so the client never offers an amount
	// the server would refuse. Never trusted from the client either way.
	Amount     int64     `json:"amount" validate:"required,gt=0,lte=99999999999999"`
	Type       string    `json:"type" validate:"required,oneof=income expense transfer"`
	// ToWalletID is the destination Wallet of a transfer (WalletID is the
	// source). Required for a transfer, rejected by the service otherwise.
	ToWalletID *uuid.UUID `json:"to_wallet_id" validate:"required_if=Type transfer"`
	OccurredAt *string    `json:"occurred_at"`
	Note       *string    `json:"note" validate:"omitempty,max=500"`
	// IdempotencyKey is optional and general-purpose — any caller may supply
	// one (specs/ai-chat-assistant/spec.md Resolved design decision #5, Open
	// Questions #4). Every existing caller (the manual "Add transaction"
	// dialog) omits it, so behavior for them is unchanged: a fresh 201 every
	// time. Reusing a previously-used key returns the original Transaction
	// (200) instead of creating a duplicate.
	IdempotencyKey *uuid.UUID `json:"idempotency_key"`
}

// UpdateTransactionRequest is the body of PATCH /transactions/{id}.
// Deliberately has no wallet_id or type field at the type level (spec.md:
// "never accepted by this endpoint" — Context #5) — decoded via
// dto.DecodeStrict so an unrecognized field is rejected with 400, not
// silently ignored, mirroring UpdateWalletRequest/UpdateBudgetRequest's
// precedent. OccurredAt is a string for the same reason as
// CreateTransactionRequest's.
type UpdateTransactionRequest struct {
	Amount     *int64     `json:"amount" validate:"omitempty,gt=0,lte=99999999999999"`
	CategoryID *uuid.UUID `json:"category_id"`
	OccurredAt *string    `json:"occurred_at"`
	Note       *string    `json:"note" validate:"omitempty,max=500"`
}

// HasUpdates reports whether at least one field was supplied — an empty body
// is a client mistake (400), not a no-op 200 (spec.md S-TRX-46).
func (r UpdateTransactionRequest) HasUpdates() bool {
	return r.Amount != nil || r.CategoryID != nil || r.OccurredAt != nil || r.Note != nil
}

// ListTransactionsQuery is the query-string binding for GET /transactions.
// Every filter is a plain string (mirroring dto.ListUsersQuery's convention,
// not *uuid.UUID/*time.Time) — parsed and validated in
// TransactionService.ListTransactions, since Fiber's query binder doesn't
// natively support pointer-to-uuid.UUID/pointer-to-time.Time.
type ListTransactionsQuery struct {
	WalletID   string `query:"wallet_id" validate:"omitempty,uuid4"`
	CategoryID string `query:"category_id" validate:"omitempty,uuid4"`
	// CategoryIDs is a comma-separated list of category UUIDs for the
	// Transactions screen's multi-select category filter — additive with
	// CategoryID (a caller sends one or the other in practice). Each entry is
	// parsed/validated as a UUID and ownership-checked in
	// TransactionService.ListTransactions, same as CategoryID; the struct tag
	// can't express "comma-separated uuid4 list" so that validation happens
	// there, not here.
	CategoryIDs string `query:"category_ids"`
	Type        string `query:"type" validate:"omitempty,oneof=income expense transfer"`
	From        string `query:"from"`
	To          string `query:"to"`
	// Search is an ILIKE substring match against a transaction's note (its
	// only free-text field) — max=200 is generous headroom over
	// common.TransactionNoteMaxLength (500) purely to bound query size, not a
	// meaningful UX limit.
	Search string `query:"search" validate:"omitempty,max=200"`
	Cursor string `query:"cursor"`
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=100"`
}
