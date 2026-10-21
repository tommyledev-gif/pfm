package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const listTransactionsInWindow = `-- name: ListTransactionsInWindow :many
SELECT
    t.id, t.amount, t.occurred_at, t.category_id,
    c.name AS category_name, w.name AS wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.type = $2
  AND t.type IN ('expense', 'income')
  AND t.deleted_at IS NULL
  AND w.currency = $3
  AND t.occurred_at >= $4::timestamptz
  AND t.occurred_at < $5::timestamptz
  AND ($6::uuid[] IS NULL OR t.category_id = ANY($6::uuid[]))
  AND ($7::uuid IS NULL OR t.wallet_id = $7)
ORDER BY t.occurred_at DESC, t.id DESC
LIMIT $8
`

type ListTransactionsInWindowParams struct {
	UserID      uuid.UUID
	TxType      string
	Currency    string
	WindowStart time.Time
	WindowEnd   time.Time
	CategoryIDs []uuid.UUID
	WalletID    *uuid.UUID
	RowLimit    int32
}

type ListTransactionsInWindowRow struct {
	ID           uuid.UUID
	Amount       int64
	OccurredAt   time.Time
	CategoryID   uuid.UUID
	CategoryName string
	WalletName   string
}

// ListTransactionsInWindow backs the "anything unusual" answer
// (db/queries/analytics_anomaly.sql): one type's rows over the period and its
// baseline, newest first. No note column, by design (plan.md BR-22).
func (q *Queries) ListTransactionsInWindow(ctx context.Context, arg ListTransactionsInWindowParams) ([]ListTransactionsInWindowRow, error) {
	rows, err := q.db.Query(ctx, listTransactionsInWindow,
		arg.UserID, arg.TxType, arg.Currency, arg.WindowStart, arg.WindowEnd,
		arg.CategoryIDs, arg.WalletID, arg.RowLimit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListTransactionsInWindowRow
	for rows.Next() {
		var i ListTransactionsInWindowRow
		if err := rows.Scan(&i.ID, &i.Amount, &i.OccurredAt, &i.CategoryID, &i.CategoryName, &i.WalletName); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
