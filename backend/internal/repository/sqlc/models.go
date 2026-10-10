package sqlc

import (
	"time"

	"github.com/google/uuid"
)

// User mirrors the users table exactly, column for column — this is the raw
// row shape sqlc would generate. Repository code converts this into
// model.User; nothing outside internal/repository should ever see this type.
type User struct {
	ID                uuid.UUID
	Email             string
	FullName          *string
	PasswordHash      *string
	Status            string
	Role              string
	InvitedBy         *uuid.UUID
	InviteToken       *string
	InviteExpiresAt   *time.Time
	ActivatedAt       *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
	DeletedAt         *time.Time
	InviteSentAt      *time.Time
	InviteResendCount int32
	// TokensValidAfter (mig 025) and AvatarURL (mig 027) are populated ONLY by
	// GetUserByID and the profile queries (users_profile.sql.go); every other
	// users query leaves them nil (hand-edited, not regenerated).
	TokensValidAfter *time.Time
	AvatarURL        *string
}

// RevokedToken mirrors the revoked_tokens table exactly.
type RevokedToken struct {
	ID        uuid.UUID
	TokenJTI  string
	UserID    *uuid.UUID
	ExpiresAt time.Time
	RevokedAt time.Time
}

// Wallet mirrors the wallets table exactly (004_wallets.sql).
type Wallet struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Name      string
	Type      string
	Balance   int64
	Currency  string
	IsDefault bool
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
	Icon      *string
	IconURL   *string
}

// Category mirrors the categories table exactly (005_categories.sql).
// UserID is nullable: NULL means system-defined, shared across every user.
// No UpdatedAt column exists for this table (CLAUDE.md Core DB Schema).
type Category struct {
	ID        uuid.UUID
	UserID    *uuid.UUID
	Name      string
	Icon      *string
	Type      string
	CreatedAt time.Time
	DeletedAt *time.Time
	IconURL   *string
	SystemKey *string
}

// Budget mirrors the budgets table exactly (007_budgets.sql). Per-currency
// limits live in the separate BudgetLimit rows, not on this struct.
type Budget struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	CategoryID uuid.UUID
	Period     string
	StartDate  time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  *time.Time
	Icon       *string
	IconURL    *string
}

// BudgetLimit mirrors the budget_limits table exactly (007_budgets.sql).
// Composite PK (budget_id, currency) — at most one row per currency per
// Budget.
type BudgetLimit struct {
	BudgetID    uuid.UUID
	Currency    string
	AmountLimit int64
}

// Transaction mirrors the transactions table exactly (008_transactions.sql +
// the additive idempotency_key column from 010_transactions_idempotency_key.sql).
type Transaction struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	WalletID       uuid.UUID
	CategoryID     uuid.UUID
	Amount         int64
	Type           string
	Note           *string
	OccurredAt     time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      *time.Time
	IdempotencyKey *uuid.UUID
	// ToWalletID is the destination of a transfer (022_transaction_transfer.sql);
	// nil for income/expense.
	ToWalletID *uuid.UUID
	// Location* (026_transactions_location.sql) are all nil for a Transaction
	// recorded without a map pin. Lat/Lng are a measurement, not money, so
	// float8 is correct here.
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
	LocationNote *string
}

// Notification mirrors the notifications table exactly (009_notifications.sql).
// RelatedBudgetID/Currency/PeriodStart are only non-nil for
// type = "budget_exceeded" (enforced by a CHECK constraint at the DB level,
// specs/notification-handling/plan.md Finding #3) — no other notification
// type exists in MVP. No DeletedAt: this table has no delete story
// (specs/notification-handling/spec.md Out of Scope).
type Notification struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	Type            string
	Title           string
	Body            string
	IsRead          bool
	RelatedBudgetID *uuid.UUID
	Currency        *string
	PeriodStart     *time.Time
	CreatedAt       time.Time
}

// ChatMessage mirrors the chat_messages table exactly (011_chat_messages.sql,
// specs/ai-chat-assistant). TransactionIDs is left NULL by every write this
// cut performs (linking a confirmed Transaction back to its originating
// message is explicitly deferred — specs/ai-chat-assistant/spec.md Open
// Question #8). No DeletedAt: append-only historical log, same precedent as
// Notification.
type ChatMessage struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	ConversationID uuid.UUID
	Role           string
	Content        string
	Intent         *string
	TransactionIDs []uuid.UUID
	CreatedAt      time.Time
}

// ChatThreadMessage mirrors the chat_thread_messages table exactly
// (015_chat_thread_sync.sql). Payload is opaque JSON text — the backend
// never inspects its fields, only stores/returns it verbatim by
// (UserID, ClientMessageID). No DeletedAt: a UI cache, not a financial
// record, same precedent as ChatMessage/Notification.
type ChatThreadMessage struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	ClientMessageID string
	Payload         string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// TransactionAuditLog mirrors the transaction_audit_logs table exactly
// (018_transaction_audit_logs.sql, specs/transaction-audit-log). Before/After
// are raw JSONB bytes — nil for the SQL NULL that a create (no before) or a
// delete (no after) legitimately has. No UpdatedAt/DeletedAt: append-only,
// never updated and never deleted, a stricter guarantee than the soft-delete
// rule the financial tables follow.
type TransactionAuditLog struct {
	ID            uuid.UUID
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Action        string
	Before        []byte
	After         []byte
	CreatedAt     time.Time
}
