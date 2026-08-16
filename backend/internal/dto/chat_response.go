package dto

import (
	"time"

	"github.com/google/uuid"
)

// TransactionActionPayload is exactly the shape a confirmed action's fields
// take when the client turns around and calls POST /transactions — mirrors
// CreateTransactionRequest's fields (minus IdempotencyKey, carried alongside
// it in ChatActionResponse instead of duplicated inside the payload).
type TransactionActionPayload struct {
	WalletID   uuid.UUID `json:"wallet_id"`
	CategoryID uuid.UUID `json:"category_id"`
	Amount     int64     `json:"amount"`
	Type       string    `json:"type"`
	Note       *string   `json:"note"`
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
}

// ChatResponse is the body of POST /ai/chat's 200 response. Intent is
// "create_transaction" or "ambiguous" for this cut (spec.md Resolved design
// decision #2) — Actions is always an empty (not null) slice when there is
// nothing to confirm.
type ChatResponse struct {
	Message        string               `json:"message"`
	Intent         string               `json:"intent"`
	Actions        []ChatActionResponse `json:"actions"`
	ConversationID uuid.UUID            `json:"conversation_id"`
}
