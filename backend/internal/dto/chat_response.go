package dto

import (
	"time"

	"github.com/google/uuid"
)

// TransactionActionPayload is exactly the shape a confirmed action's fields
// take when the client turns around and calls POST /transactions — mirrors
// CreateTransactionRequest's fields (minus IdempotencyKey, carried alongside
// it in ChatActionResponse instead of duplicated inside the payload).
// WalletID is null only when the caller owns no VND Wallet — the client must
// have the User pick one before confirming (ai-chat-image-capture BR-13).
type TransactionActionPayload struct {
	WalletID   *uuid.UUID `json:"wallet_id"`
	CategoryID uuid.UUID  `json:"category_id"`
	Amount     int64      `json:"amount"`
	Type       string     `json:"type"`
	Note       *string    `json:"note"`
	OccurredAt time.Time  `json:"occurred_at"`
	// Items of one purchase (specs/transaction-line-items, typed chat): when
	// present, Amount equals their sum. Forwarded unchanged on confirm.
	Items []ChatActionItem `json:"items,omitempty"`
	// Adjustments read from a receipt image (ai-chat-image-capture BR-15):
	// tax, fee and discount lines, same shape as CreateTransactionRequest's.
	// Image proposals keep the printed total as Amount — the lines may not
	// add up, which the client checks before a direct save.
	Adjustments []ChatActionAdjustment `json:"adjustments,omitempty"`
	// ToWalletID is a transfer's destination Wallet; nil on income/expense,
	// and nil on a transfer whose destination the AI could not name (the
	// client has the User pick one before saving). A transfer's CategoryID is
	// uuid.Nil: the server files it under the system transfer category.
	ToWalletID *uuid.UUID `json:"to_wallet_id,omitempty"`
}

// ChatActionItem has CreateTransactionRequest's item shape, money in xu.
type ChatActionItem struct {
	Name      string `json:"name"`
	Quantity  int32  `json:"quantity"`
	UnitPrice *int64 `json:"unit_price,omitempty"`
	Amount    int64  `json:"amount"`
}

// ChatActionAdjustment has CreateTransactionRequest's adjustment shape,
// money in xu. Direction is always set (it matches the kind for tax, fee
// and discount).
type ChatActionAdjustment struct {
	Kind      string  `json:"kind"`
	Direction string  `json:"direction"`
	Label     *string `json:"label,omitempty"`
	Amount    int64   `json:"amount"`
}

// ChatActionReviewLines lists, by index into the payload's Items and
// Adjustments, the lines read with doubt (ai-chat-image-capture BR-16).
// Kept beside the payload, never inside it: the confirm body is strict.
type ChatActionReviewLines struct {
	Items       []int `json:"items"`
	Adjustments []int `json:"adjustments"`
}

// ChatActionDuplicate is the latest saved Transaction an image proposal
// looks like (same Wallet, type, amount and day — BR-17). A warning only.
type ChatActionDuplicate struct {
	Amount     int64     `json:"amount"`
	OccurredAt time.Time `json:"occurred_at"`
}

// ChatActionResponse is one proposed Transaction the User must explicitly
// confirm — IdempotencyKey is pre-generated server-side (specs/ai-chat-assistant/spec.md
// Edge Case #2), never client- or AI-Service-supplied.
type ChatActionResponse struct {
	Type           string                   `json:"type"`
	Payload        TransactionActionPayload `json:"payload"`
	IdempotencyKey uuid.UUID                `json:"idempotency_key"`
	Confidence     float64                  `json:"confidence"`
	// Image proposals only; nil (omitted) on typed replies.
	ReviewLines       *ChatActionReviewLines `json:"review_lines,omitempty"`
	PossibleDuplicate *ChatActionDuplicate   `json:"possible_duplicate,omitempty"`
}

// ChatResponse is the body of POST /ai/chat's 200 response. Intent is
// "create_transaction", "ambiguous", or (specs/ai-budget-wizard/spec.md US-02)
// "budget_wizard" — Actions is always an empty (not null) slice when there is
// nothing to confirm. ActionType is only set for "budget_wizard" (nil
// otherwise) — the client uses it to decide whether to render a tappable
// budget-wizard card instead of the usual Transaction action cards.
type ChatResponse struct {
	Message        string               `json:"message"`
	Intent         string               `json:"intent"`
	Actions        []ChatActionResponse `json:"actions"`
	ConversationID uuid.UUID            `json:"conversation_id"`
	ActionType     *string              `json:"action_type,omitempty"`
}
