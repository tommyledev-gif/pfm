package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const createTransaction = `-- name: CreateTransaction :one
INSERT INTO transactions (user_id, wallet_id, category_id, amount, type, note, occurred_at, idempotency_key, to_wallet_id,
                          location_lat, location_lng, location_name, location_note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id,
          location_lat, location_lng, location_name, location_note
`

type CreateTransactionParams struct {
	UserID     uuid.UUID
	WalletID   uuid.UUID
	CategoryID uuid.UUID
	Amount     int64
	Type       string
	Note       *string
	OccurredAt time.Time
	// IdempotencyKey is nullable — every pre-existing caller omits it and gets
	// NULL, which the partial unique index (010_transactions_idempotency_key.sql)
	// never treats as a collision (specs/ai-chat-assistant/plan.md Finding #3).
	IdempotencyKey *uuid.UUID
	// ToWalletID is set only for a transfer.
	ToWalletID *uuid.UUID
	// Location* are all nil for a Transaction recorded without a map pin
	// (026_transactions_location.sql).
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
	LocationNote *string
}

func (q *Queries) CreateTransaction(ctx context.Context, arg CreateTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, createTransaction,
		arg.UserID, arg.WalletID, arg.CategoryID, arg.Amount, arg.Type, arg.Note, arg.OccurredAt, arg.IdempotencyKey,
		arg.ToWalletID, arg.LocationLat, arg.LocationLng, arg.LocationName, arg.LocationNote,
	)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
		&i.ToWalletID, &i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
	)
	return i, err
}

const getTransactionByIdempotencyKey = `-- name: GetTransactionByIdempotencyKey :one
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name,
    t.to_wallet_id, tw.name AS to_wallet_name,
    t.location_lat, t.location_lng, t.location_name, t.location_note
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
WHERE t.user_id = $1
  AND t.idempotency_key = $2
LIMIT 1
`

type GetTransactionByIdempotencyKeyRow struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	WalletID     uuid.UUID
	CategoryID   uuid.UUID
	Amount       int64
	Type         string
	Note         *string
	OccurredAt   time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
	WalletName   string
	CategoryName string
	ToWalletID   *uuid.UUID
	ToWalletName *string
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
	LocationNote *string
}

// GetTransactionByIdempotencyKey backs the AI Chat confirm-step replay check
// (specs/ai-chat-assistant/spec.md Resolved design decision #5, S-AI-13) —
// scoped by (user_id, idempotency_key) so one caller can never observe or
// collide with another caller's key.
func (q *Queries) GetTransactionByIdempotencyKey(ctx context.Context, userID uuid.UUID, idempotencyKey uuid.UUID) (GetTransactionByIdempotencyKeyRow, error) {
	row := q.db.QueryRow(ctx, getTransactionByIdempotencyKey, userID, idempotencyKey)
	var i GetTransactionByIdempotencyKeyRow
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
		&i.WalletName, &i.CategoryName, &i.ToWalletID, &i.ToWalletName,
		&i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
	)
	return i, err
}

const getTransactionByID = `-- name: GetTransactionByID :one
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name,
    t.to_wallet_id, tw.name AS to_wallet_name,
    t.location_lat, t.location_lng, t.location_name, t.location_note
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
WHERE t.id = $1
  AND t.deleted_at IS NULL
LIMIT 1
`

type GetTransactionByIDRow struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	WalletID     uuid.UUID
	CategoryID   uuid.UUID
	Amount       int64
	Type         string
	Note         *string
	OccurredAt   time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
	WalletName   string
	CategoryName string
	ToWalletID   *uuid.UUID
	ToWalletName *string
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
	LocationNote *string
}

// GetTransactionByID is deliberately NOT scoped by user_id, same precedent as
// GetWalletByID/GetCategoryByID/GetBudgetByID — the service layer decides 403
// vs. 404. The categories join is a plain JOIN, never filtered on
// categories.deleted_at (specs/transaction-management/plan.md Finding #6) —
// a soft-deleted category's row still exists and its name must still resolve.
func (q *Queries) GetTransactionByID(ctx context.Context, id uuid.UUID) (GetTransactionByIDRow, error) {
	row := q.db.QueryRow(ctx, getTransactionByID, id)
	var i GetTransactionByIDRow
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
		&i.WalletName, &i.CategoryName, &i.ToWalletID, &i.ToWalletName,
		&i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
	)
	return i, err
}

const getTransactionOwnerIncludingDeleted = `-- name: GetTransactionOwnerIncludingDeleted :one
SELECT user_id
FROM transactions
WHERE id = $1
LIMIT 1
`

// GetTransactionOwnerIncludingDeleted is deliberately NOT filtered on
// deleted_at — a removed Transaction's audit history stays viewable by its
// owner. The service decides 403 vs. 404.
func (q *Queries) GetTransactionOwnerIncludingDeleted(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	row := q.db.QueryRow(ctx, getTransactionOwnerIncludingDeleted, id)
	var user_id uuid.UUID
	err := row.Scan(&user_id)
	return user_id, err
}
