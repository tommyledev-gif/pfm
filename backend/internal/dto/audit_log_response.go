package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// ListAuditLogsQuery is the query-string binding for
// GET /transactions/audit-logs. TransactionID is a plain string (parsed and
// ownership-checked in AuditLogService), mirroring ListTransactionsQuery's
// own convention rather than binding straight to *uuid.UUID, which Fiber's
// query binder doesn't support.
type ListAuditLogsQuery struct {
	TransactionID string `query:"transaction_id" validate:"omitempty,uuid4"`
	Cursor        string `query:"cursor"`
	Limit         int    `query:"limit" validate:"omitempty,min=1,max=100"`
}

// AuditLogResponse mirrors model.AuditLog. Before/After are passed through as
// raw JSON rather than a fixed struct — they carry only the fields the
// recorded operation touched (specs/transaction-audit-log/spec.md Context #4),
// so their key set varies per entry by design. `null` on either side is
// meaningful: a create has no before, a delete has no after.
type AuditLogResponse struct {
	ID            uuid.UUID       `json:"id"`
	TransactionID uuid.UUID       `json:"transaction_id"`
	Action        string          `json:"action"`
	Before        json.RawMessage `json:"before"`
	After         json.RawMessage `json:"after"`
	CreatedAt     time.Time       `json:"created_at"`
}

func NewAuditLogResponse(log *model.AuditLog) AuditLogResponse {
	return AuditLogResponse{
		ID:            log.ID,
		TransactionID: log.TransactionID,
		Action:        string(log.Action),
		Before:        nullableJSON(log.Before),
		After:         nullableJSON(log.After),
		CreatedAt:     log.CreatedAt,
	}
}

// nullableJSON turns a nil/empty column into a literal JSON `null` — without
// this, encoding/json renders an empty json.RawMessage as invalid JSON
// (an empty token) rather than null.
func nullableJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("null")
	}
	return raw
}

type ListAuditLogsResponse struct {
	Data       []AuditLogResponse `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}
