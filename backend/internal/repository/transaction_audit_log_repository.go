package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// InsertAuditLog is a method on TransactionRepository, not on the read-side
// AuditLogRepository below, on purpose: the write always happens inside
// TransactionService's own already-open pgx.Tx (the same one carrying the
// wallet-balance mutation and the transaction row write), so it belongs to
// the repository that service already holds. Splitting it out would mean
// either a second BeginTx — the exact thing spec.md Context #1 forbids — or
// passing one service's transaction into another service's repository.
func (r *TransactionRepository) InsertAuditLog(ctx context.Context, tx pgx.Tx, arg InsertAuditLogParams) error {
	_, err := r.q.WithTx(tx).InsertAuditLog(ctx, sqlc.InsertAuditLogParams{
		TransactionID: arg.TransactionID,
		UserID:        arg.UserID,
		Action:        string(arg.Action),
		Before:        arg.Before,
		After:         arg.After,
	})
	return err
}

type InsertAuditLogParams struct {
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Action        model.AuditAction
	// nil writes SQL NULL — a create has no Before, a delete has no After.
	Before []byte
	After  []byte
}

// AuditLogRepository is the read side (US-02's list endpoint). Separate from
// TransactionRepository because nothing about reading history needs a
// transaction, a wallet, or a category — it is a plain scoped query.
type AuditLogRepository struct {
	q *sqlc.Queries
}

func NewAuditLogRepository(q *sqlc.Queries) *AuditLogRepository {
	return &AuditLogRepository{q: q}
}

// ListAuditLogsFilter mirrors ListNotificationsFilter's shape — an optional
// narrowing filter plus the decoded keyset cursor and a limit the service
// has already bounded.
type ListAuditLogsFilter struct {
	TransactionID   *uuid.UUID
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
	Limit           int32
}

func (r *AuditLogRepository) ListAuditLogsByUser(ctx context.Context, userID uuid.UUID, filter ListAuditLogsFilter) ([]*model.AuditLog, error) {
	rows, err := r.q.ListAuditLogsByUser(ctx, sqlc.ListAuditLogsByUserParams{
		UserID:          userID,
		TransactionID:   filter.TransactionID,
		CursorCreatedAt: filter.CursorCreatedAt,
		CursorID:        filter.CursorID,
		Limit:           filter.Limit,
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*model.AuditLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, toAuditLogModel(row))
	}
	return logs, nil
}

func (r *AuditLogRepository) CountAuditLogs(ctx context.Context, userID uuid.UUID, transactionID *uuid.UUID) (int64, error) {
	return r.q.CountAuditLogsByUser(ctx, userID, transactionID)
}

func toAuditLogModel(row sqlc.TransactionAuditLog) *model.AuditLog {
	return &model.AuditLog{
		ID:            row.ID,
		TransactionID: row.TransactionID,
		UserID:        row.UserID,
		Action:        model.AuditAction(row.Action),
		Before:        row.Before,
		After:         row.After,
		CreatedAt:     row.CreatedAt,
	}
}
