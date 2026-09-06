package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AuditAction is what a single audit entry records happening to a
// Transaction. There is deliberately no "restore"/"undo" action — the audit
// log is a read-only history (specs/transaction-audit-log/spec.md Out of
// Scope), not a time-travel mechanism.
type AuditAction string

const (
	AuditActionCreate AuditAction = "create"
	AuditActionUpdate AuditAction = "update"
	AuditActionDelete AuditAction = "delete"
)

// AuditLog is the domain representation of the transaction_audit_logs table.
// Zero framework imports, same convention as model.Transaction/model.Wallet.
//
// Before/After carry only the fields the recorded operation actually touched
// (spec.md Context #4) — `create` has no Before, `delete` has no After, and
// an `update` carries just the keys that were present in that PATCH body, so
// "what changed" is legible without diffing two full rows. Any amount inside
// is BIGINT cents, exactly as transactions.amount stores it.
type AuditLog struct {
	ID            uuid.UUID
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Action        AuditAction
	Before        json.RawMessage
	After         json.RawMessage
	CreatedAt     time.Time
}
