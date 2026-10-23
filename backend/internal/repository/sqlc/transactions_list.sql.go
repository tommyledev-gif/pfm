package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const listTransactionsByUser = `-- name: ListTransactionsByUser :many
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
WHERE (t.user_id = $1 OR ($13::bool AND $3::uuid IS NOT NULL))
  AND t.deleted_at IS NULL
  AND ($3::uuid IS NULL OR t.wallet_id = $3 OR t.to_wallet_id = $3)
  AND ($4::uuid IS NULL OR t.category_id = $4)
  AND ($5::uuid[] IS NULL OR t.category_id = ANY($5::uuid[]))
  AND ($6::text IS NULL OR t.type = $6)
  AND ($7::timestamptz IS NULL OR t.occurred_at >= $7)
  AND ($8::timestamptz IS NULL OR t.occurred_at <= $8)
  AND ($9::text IS NULL OR t.note ILIKE '%' || $9 || '%' ESCAPE '\')
  AND (
    $10::timestamptz IS NULL
    OR t.occurred_at < $10
    OR (t.occurred_at = $10 AND t.created_at < $11)
    OR (t.occurred_at = $10 AND t.created_at = $11 AND t.id < $12)
  )
ORDER BY t.occurred_at DESC, t.created_at DESC, t.id DESC
LIMIT $2
`

type ListTransactionsByUserParams struct {
	UserID           uuid.UUID
	Limit            int32
	WalletID         *uuid.UUID
	CategoryID       *uuid.UUID
	CategoryIDs      []uuid.UUID
	Type             *string
	FromTs           *time.Time
	ToTs             *time.Time
	Search           *string
	CursorOccurredAt *time.Time
	CursorCreatedAt  *time.Time
	CursorID         *uuid.UUID
	// WalletScoped lifts the user_id filter to "every entry in WalletID" —
	// set only after the service proved the caller may read that wallet
	// (specs/shared-wallets plan F1). The SQL ignores it without a WalletID.
	WalletScoped bool
}

type ListTransactionsByUserRow struct {
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

// ListTransactionsByUser is cursor-paginated on (occurred_at, created_at, id)
// — occurred_at is the primary sort key (specs/transaction-management/
// spec.md Edge Cases US-02 #1), created_at breaks ties for same-day
// transactions, id breaks any remaining tie.
func (q *Queries) ListTransactionsByUser(ctx context.Context, arg ListTransactionsByUserParams) ([]ListTransactionsByUserRow, error) {
	rows, err := q.db.Query(ctx, listTransactionsByUser,
		arg.UserID, arg.Limit, arg.WalletID, arg.CategoryID, arg.CategoryIDs, arg.Type,
		arg.FromTs, arg.ToTs, arg.Search, arg.CursorOccurredAt, arg.CursorCreatedAt, arg.CursorID,
		arg.WalletScoped,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListTransactionsByUserRow
	for rows.Next() {
		var i ListTransactionsByUserRow
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
			&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
			&i.WalletName, &i.CategoryName, &i.ToWalletID, &i.ToWalletName,
			&i.LocationLat, &i.LocationLng, &i.LocationName, &i.LocationNote,
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

const countTransactionsByUser = `-- name: CountTransactionsByUser :one
SELECT COUNT(*)::bigint
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE (t.user_id = $1 OR ($9::bool AND $2::uuid IS NOT NULL))
  AND t.deleted_at IS NULL
  AND ($2::uuid IS NULL OR t.wallet_id = $2 OR t.to_wallet_id = $2)
  AND ($3::uuid IS NULL OR t.category_id = $3)
  AND ($4::uuid[] IS NULL OR t.category_id = ANY($4::uuid[]))
  AND ($5::text IS NULL OR t.type = $5)
  AND ($6::timestamptz IS NULL OR t.occurred_at >= $6)
  AND ($7::timestamptz IS NULL OR t.occurred_at <= $7)
  AND ($8::text IS NULL OR t.note ILIKE '%' || $8 || '%' ESCAPE '\')
`

type CountTransactionsByUserParams struct {
	UserID      uuid.UUID
	WalletID    *uuid.UUID
	CategoryID  *uuid.UUID
	CategoryIDs []uuid.UUID
	Type        *string
	FromTs      *time.Time
	ToTs        *time.Time
	Search      *string
	// WalletScoped: see ListTransactionsByUserParams.WalletScoped.
	WalletScoped bool
}

// CountTransactionsByUser is ListTransactionsByUser's WHERE clause without the
// cursor predicate or the LIMIT — the size of the whole filtered set, for the
// list response's `total`.
func (q *Queries) CountTransactionsByUser(ctx context.Context, arg CountTransactionsByUserParams) (int64, error) {
	row := q.db.QueryRow(ctx, countTransactionsByUser,
		arg.UserID, arg.WalletID, arg.CategoryID, arg.CategoryIDs, arg.Type,
		arg.FromTs, arg.ToTs, arg.Search, arg.WalletScoped,
	)
	var total int64
	err := row.Scan(&total)
	return total, err
}
