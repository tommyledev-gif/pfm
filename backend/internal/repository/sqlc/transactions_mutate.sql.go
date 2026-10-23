package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const updateTransaction = `-- name: UpdateTransaction :one
UPDATE transactions
SET
    amount        = COALESCE($3, amount),
    category_id   = COALESCE($4, category_id),
    wallet_id     = COALESCE($11, wallet_id),
    occurred_at   = COALESCE($5, occurred_at),
    note          = COALESCE($6, note),
    location_note = CASE
        WHEN $7::text IS NULL THEN location_note
        ELSE NULLIF($7::text, '')
    END,
    location_lat  = COALESCE($8::float8, location_lat),
    location_lng  = COALESCE($9::float8, location_lng),
    location_name = CASE
        WHEN $8::float8 IS NULL THEN location_name
        ELSE NULLIF($10::text, '')
    END,
    updated_at    = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id,
          location_lat, location_lng, location_name, location_note
`

type UpdateTransactionParams struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Amount     *int64
	CategoryID *uuid.UUID
	OccurredAt *time.Time
	Note       *string
	// LocationNote: nil leaves the column unchanged, "" clears it to NULL,
	// anything else sets it (026_transactions_location.sql).
	LocationNote *string
	// LocationLat/LocationLng: nil leaves the pin unchanged; non-nil (always
	// both) moves it. LocationName is only read when LocationLat is non-nil:
	// it replaces location_name, nil or "" storing NULL.
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
	// WalletID ($11, appended so the other placeholders keep their numbers):
	// nil leaves it unchanged, non-nil moves the Transaction to that Wallet.
	WalletID *uuid.UUID
}

// UpdateTransaction returns every column explicitly — the Scan below includes
// IdempotencyKey (010_transactions_idempotency_key.sql), ToWalletID
// (022_transaction_transfer.sql) and the Location* columns
// (026_transactions_location.sql) as the trailing columns; of those, this
// statement touches only the Location* ones (a pin move and/or its note).
func (q *Queries) UpdateTransaction(ctx context.Context, arg UpdateTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, updateTransaction,
		arg.ID, arg.UserID, arg.Amount, arg.CategoryID, arg.OccurredAt, arg.Note, arg.LocationNote,
		arg.LocationLat, arg.LocationLng, arg.LocationName, arg.WalletID,
	)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
		&i.ToWalletID, &i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
	)
	return i, err
}

const softDeleteTransaction = `-- name: SoftDeleteTransaction :one
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id,
          location_lat, location_lng, location_name, location_note
`

type SoftDeleteTransactionParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
}

// SoftDeleteTransaction returns every column explicitly — same trailing-column
// note as UpdateTransaction above.
func (q *Queries) SoftDeleteTransaction(ctx context.Context, arg SoftDeleteTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, softDeleteTransaction, arg.ID, arg.UserID)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
		&i.ToWalletID, &i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
	)
	return i, err
}

const existsTransactionForWallet = `-- name: ExistsTransactionForWallet :one
SELECT EXISTS (
    SELECT 1 FROM transactions
    WHERE (wallet_id = $1 OR to_wallet_id = $1)
      AND deleted_at IS NULL
) AS "exists"
`

// ExistsTransactionForWallet backs F-03's 409 CURRENCY_LOCKED check
// (WAL-T14) — called from WalletRepository via the shared *Queries struct
// (cross-repository query exception).
func (q *Queries) ExistsTransactionForWallet(ctx context.Context, walletID uuid.UUID) (bool, error) {
	row := q.db.QueryRow(ctx, existsTransactionForWallet, walletID)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}
