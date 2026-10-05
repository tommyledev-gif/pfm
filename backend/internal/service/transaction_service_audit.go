package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// Audit-log writes for F-06's three mutating operations
// (specs/transaction-audit-log/spec.md US-01). Every one of these runs inside
// the caller's already-open pgx.Tx and is therefore committed or rolled back
// with the mutation it records — never a best-effort side write, and never
// its own transaction (spec.md Context #1). A failure here fails the whole
// request rather than silently leaving history incomplete.

// writeAuditLog marshals before/after and inserts one row. A nil map writes
// SQL NULL, which is exactly what `create` (no before) and `delete` (no
// after) mean.
func (s *TransactionService) writeAuditLog(
	ctx context.Context,
	tx pgx.Tx,
	userID, transactionID uuid.UUID,
	action model.AuditAction,
	before, after map[string]any,
) error {
	beforeJSON, err := marshalAuditSide(before)
	if err != nil {
		return fmt.Errorf("service.writeAuditLog: %w", err)
	}
	afterJSON, err := marshalAuditSide(after)
	if err != nil {
		return fmt.Errorf("service.writeAuditLog: %w", err)
	}

	if err := s.repo.InsertAuditLog(ctx, tx, repository.InsertAuditLogParams{
		TransactionID: transactionID,
		UserID:        userID,
		Action:        action,
		Before:        beforeJSON,
		After:         afterJSON,
	}); err != nil {
		return fmt.Errorf("service.writeAuditLog: %w", err)
	}
	return nil
}

func marshalAuditSide(side map[string]any) ([]byte, error) {
	if side == nil {
		return nil, nil
	}
	return json.Marshal(side)
}

// auditSnapshot is the full field set recorded on create (as `after`) and on
// delete (as `before`) — the two actions where the whole Transaction, rather
// than a diff, is the meaningful record. Amount stays integer cents.
func auditSnapshot(t *model.Transaction) map[string]any {
	snapshot := map[string]any{
		"wallet_id":   t.WalletID,
		"category_id": t.CategoryID,
		"amount":      t.Amount,
		"type":        string(t.Type),
		"occurred_at": t.OccurredAt,
	}
	if t.ToWalletID != nil {
		snapshot["to_wallet_id"] = *t.ToWalletID
	}
	if t.Note != nil {
		snapshot["note"] = *t.Note
	} else {
		snapshot["note"] = nil
	}
	// Only when present, same as to_wallet_id. Keys mirror the API's
	// `location` object; nil *string fields marshal as null.
	if t.Location != nil {
		snapshot["location"] = map[string]any{
			"latitude":   t.Location.Latitude,
			"longitude":  t.Location.Longitude,
			"place_name": t.Location.PlaceName,
			"note":       t.Location.Note,
		}
	}
	return snapshot
}

// auditUpdateDiff records only the fields present in this specific PATCH body
// (spec.md Context #4, S-TAL-02/S-TAL-03) — an update that only touched
// `note` must not fabricate an unchanged `amount` into the log. Keyed on
// which DTO fields were supplied, not on whether the value actually differs:
// re-submitting an identical value is still logged (spec.md S-TAL-07, an
// explicit assumption flagged in that spec's Open Questions #1).
// locationNote is the normalized value actually written (nil = not in this
// PATCH, "" = cleared), so a clear is logged as `null`, matching the column.
func auditUpdateDiff(existing *model.Transaction, req dto.UpdateTransactionRequest, occurredAt *time.Time, locationNote *string) (map[string]any, map[string]any) {
	before := map[string]any{}
	after := map[string]any{}

	if req.Amount != nil {
		before["amount"] = existing.Amount
		after["amount"] = *req.Amount
	}
	if req.CategoryID != nil {
		before["category_id"] = existing.CategoryID
		after["category_id"] = *req.CategoryID
	}
	if occurredAt != nil {
		before["occurred_at"] = existing.OccurredAt
		after["occurred_at"] = *occurredAt
	}
	if req.Note != nil {
		if existing.Note != nil {
			before["note"] = *existing.Note
		} else {
			before["note"] = nil
		}
		after["note"] = *req.Note
	}
	// Keyed on the PATCH field name, like the others. The service has already
	// rejected a location_note on a Transaction with no location, so
	// existing.Location is non-nil here.
	if locationNote != nil && existing.Location != nil {
		before["location_note"] = nullableAuditString(existing.Location.Note)
		if *locationNote == "" {
			after["location_note"] = nil
		} else {
			after["location_note"] = *locationNote
		}
	}

	return before, after
}

// nullableAuditString renders a *string as its value, or a JSON null.
func nullableAuditString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
