package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Hand-authored in this package's existing plain-pointer style rather than
// produced by `sqlc generate` — see db.go's package comment. db/queries/
// transaction_lines.sql remains the source of truth for these queries.

type TransactionLine struct {
	ID            uuid.UUID
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Position      int16
	Kind          string
	Sign          int16
	Name          *string
	Quantity      *int32
	UnitPrice     *int64
	Amount        int64
	CreatedAt     time.Time
	DeletedAt     *time.Time
}

const insertTransactionLine = `-- name: InsertTransactionLine :exec
INSERT INTO transaction_lines (transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`

type InsertTransactionLineParams struct {
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Position      int16
	Kind          string
	Sign          int16
	Name          *string
	Quantity      *int32
	UnitPrice     *int64
	Amount        int64
}

func (q *Queries) InsertTransactionLine(ctx context.Context, arg InsertTransactionLineParams) error {
	_, err := q.db.Exec(ctx, insertTransactionLine,
		arg.TransactionID, arg.UserID, arg.Position, arg.Kind, arg.Sign,
		arg.Name, arg.Quantity, arg.UnitPrice, arg.Amount,
	)
	return err
}

const listActiveLinesByTransaction = `-- name: ListActiveLinesByTransaction :many
SELECT id, transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount, created_at, deleted_at
FROM transaction_lines
WHERE transaction_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY position, id
`

func (q *Queries) ListActiveLinesByTransaction(ctx context.Context, transactionID, userID uuid.UUID) ([]TransactionLine, error) {
	return q.queryLines(ctx, listActiveLinesByTransaction, transactionID, userID)
}

const listActiveLinesByTransactionIDs = `-- name: ListActiveLinesByTransactionIDs :many
SELECT id, transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount, created_at, deleted_at
FROM transaction_lines
WHERE user_id = $1
  AND transaction_id = ANY($2::uuid[])
  AND deleted_at IS NULL
ORDER BY transaction_id, position, id
`

func (q *Queries) ListActiveLinesByTransactionIDs(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) ([]TransactionLine, error) {
	return q.queryLines(ctx, listActiveLinesByTransactionIDs, userID, transactionIDs)
}

const softDeleteActiveLinesByTransaction = `-- name: SoftDeleteActiveLinesByTransaction :exec
UPDATE transaction_lines
SET deleted_at = NOW()
WHERE transaction_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
`

func (q *Queries) SoftDeleteActiveLinesByTransaction(ctx context.Context, transactionID, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, softDeleteActiveLinesByTransaction, transactionID, userID)
	return err
}

const countActiveItemsByTransactionIDs = `-- name: CountActiveItemsByTransactionIDs :many
SELECT transaction_id, COUNT(*)::int AS item_count
FROM transaction_lines
WHERE user_id = $1
  AND transaction_id = ANY($2::uuid[])
  AND kind = 'item'
  AND deleted_at IS NULL
GROUP BY transaction_id
`

type CountActiveItemsByTransactionIDsRow struct {
	TransactionID uuid.UUID
	ItemCount     int32
}

func (q *Queries) CountActiveItemsByTransactionIDs(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) ([]CountActiveItemsByTransactionIDsRow, error) {
	rows, err := q.db.Query(ctx, countActiveItemsByTransactionIDs, userID, transactionIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CountActiveItemsByTransactionIDsRow
	for rows.Next() {
		var i CountActiveItemsByTransactionIDsRow
		if err := rows.Scan(&i.TransactionID, &i.ItemCount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const lockTransactionForUpdate = `-- name: LockTransactionForUpdate :one
SELECT amount, updated_at, wallet_id, type, to_wallet_id
FROM transactions
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
FOR UPDATE
`

type LockTransactionForUpdateRow struct {
	Amount     int64
	UpdatedAt  time.Time
	WalletID   uuid.UUID
	Type       string
	ToWalletID *uuid.UUID
}

func (q *Queries) LockTransactionForUpdate(ctx context.Context, id, userID uuid.UUID) (LockTransactionForUpdateRow, error) {
	row := q.db.QueryRow(ctx, lockTransactionForUpdate, id, userID)
	var i LockTransactionForUpdateRow
	err := row.Scan(&i.Amount, &i.UpdatedAt, &i.WalletID, &i.Type, &i.ToWalletID)
	return i, err
}

func (q *Queries) queryLines(ctx context.Context, query string, args ...interface{}) ([]TransactionLine, error) {
	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []TransactionLine
	for rows.Next() {
		var i TransactionLine
		if err := rows.Scan(
			&i.ID, &i.TransactionID, &i.UserID, &i.Position, &i.Kind, &i.Sign,
			&i.Name, &i.Quantity, &i.UnitPrice, &i.Amount, &i.CreatedAt, &i.DeletedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
