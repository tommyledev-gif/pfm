package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Hand-authored in this package's existing plain-pointer style rather than
// produced by `sqlc generate` — see db.go's package comment for why running
// the real generator is out of scope for a single feature. db/queries/
// transaction_audit_logs.sql remains the source of truth for these queries.

const insertAuditLog = `-- name: InsertAuditLog :one
INSERT INTO transaction_audit_logs (transaction_id, user_id, action, before, after)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, transaction_id, user_id, action, before, after, created_at
`

type InsertAuditLogParams struct {
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Action        string
	// Raw JSON, or nil for the SQL NULL an action legitimately has no side
	// for (create has no `before`, delete has no `after`).
	Before []byte
	After  []byte
}

func (q *Queries) InsertAuditLog(ctx context.Context, arg InsertAuditLogParams) (TransactionAuditLog, error) {
	row := q.db.QueryRow(ctx, insertAuditLog, arg.TransactionID, arg.UserID, arg.Action, arg.Before, arg.After)
	var i TransactionAuditLog
	err := row.Scan(&i.ID, &i.TransactionID, &i.UserID, &i.Action, &i.Before, &i.After, &i.CreatedAt)
	return i, err
}

const listAuditLogsByUser = `-- name: ListAuditLogsByUser :many
SELECT id, transaction_id, user_id, action, before, after, created_at
FROM transaction_audit_logs
WHERE user_id = $1
  AND ($2::uuid IS NULL OR transaction_id = $2::uuid)
  AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
ORDER BY created_at DESC, id DESC
LIMIT $5
`

type ListAuditLogsByUserParams struct {
	UserID          uuid.UUID
	TransactionID   *uuid.UUID
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
	Limit           int32
}

func (q *Queries) ListAuditLogsByUser(ctx context.Context, arg ListAuditLogsByUserParams) ([]TransactionAuditLog, error) {
	rows, err := q.db.Query(ctx, listAuditLogsByUser, arg.UserID, arg.TransactionID, arg.CursorCreatedAt, arg.CursorID, arg.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []TransactionAuditLog
	for rows.Next() {
		var i TransactionAuditLog
		if err := rows.Scan(&i.ID, &i.TransactionID, &i.UserID, &i.Action, &i.Before, &i.After, &i.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const countAuditLogsByUser = `-- name: CountAuditLogsByUser :one
SELECT COUNT(*)
FROM transaction_audit_logs
WHERE user_id = $1
  AND ($2::uuid IS NULL OR transaction_id = $2::uuid)
`

func (q *Queries) CountAuditLogsByUser(ctx context.Context, userID uuid.UUID, transactionID *uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countAuditLogsByUser, userID, transactionID)
	var total int64
	err := row.Scan(&total)
	return total, err
}
