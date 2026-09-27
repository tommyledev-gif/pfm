package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const listExpensesByAmount = `-- name: ListExpensesByAmount :many
SELECT
    t.id, t.amount, t.occurred_at, t.category_id, t.wallet_id,
    c.name AS category_name, w.name AS wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = $2
  AND t.occurred_at >= $3::timestamptz
  AND t.occurred_at < $4::timestamptz
  AND ($5::bigint IS NULL OR t.amount >= $5)
  AND ($6::uuid[] IS NULL OR t.category_id = ANY($6::uuid[]))
  AND ($7::uuid IS NULL OR t.wallet_id = $7)
ORDER BY t.amount DESC, t.occurred_at DESC, t.id DESC
LIMIT $8
`

type ListExpensesByAmountParams struct {
	UserID      uuid.UUID
	Currency    string
	WindowStart time.Time
	WindowEnd   time.Time
	AmountMin   *int64
	CategoryIDs []uuid.UUID
	WalletID    *uuid.UUID
	RowLimit    int32
}

type ListExpensesByAmountRow struct {
	ID           uuid.UUID
	Amount       int64
	OccurredAt   time.Time
	CategoryID   uuid.UUID
	WalletID     uuid.UUID
	CategoryName string
	WalletName   string
}

// ListExpensesByAmount backs Q5/Q6/Q14 (specs/ai-chat-query-spending/plan.md
// AIQ-T12). No note column, by design (plan.md BR-22).
func (q *Queries) ListExpensesByAmount(ctx context.Context, arg ListExpensesByAmountParams) ([]ListExpensesByAmountRow, error) {
	rows, err := q.db.Query(ctx, listExpensesByAmount,
		arg.UserID, arg.Currency, arg.WindowStart, arg.WindowEnd,
		arg.AmountMin, arg.CategoryIDs, arg.WalletID, arg.RowLimit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListExpensesByAmountRow
	for rows.Next() {
		var i ListExpensesByAmountRow
		if err := rows.Scan(&i.ID, &i.Amount, &i.OccurredAt, &i.CategoryID, &i.WalletID, &i.CategoryName, &i.WalletName); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const countTransactionsInWindow = `-- name: CountTransactionsInWindow :one
SELECT COUNT(*)::bigint
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND w.currency = $2
  AND t.occurred_at >= $3::timestamptz
  AND t.occurred_at < $4::timestamptz
  AND ($5::text IS NULL OR t.type = $5)
  AND t.type <> 'transfer'
  AND ($6::bigint IS NULL OR t.amount >= $6)
  AND ($7::uuid[] IS NULL OR t.category_id = ANY($7::uuid[]))
  AND ($8::uuid IS NULL OR t.wallet_id = $8)
`

type CountTransactionsInWindowParams struct {
	UserID      uuid.UUID
	Currency    string
	WindowStart time.Time
	WindowEnd   time.Time
	TxType      *string
	AmountMin   *int64
	CategoryIDs []uuid.UUID
	WalletID    *uuid.UUID
}

// CountTransactionsInWindow backs tx_count / total_matched
// (specs/ai-chat-query-spending/plan.md F9).
func (q *Queries) CountTransactionsInWindow(ctx context.Context, arg CountTransactionsInWindowParams) (int64, error) {
	row := q.db.QueryRow(ctx, countTransactionsInWindow,
		arg.UserID, arg.Currency, arg.WindowStart, arg.WindowEnd,
		arg.TxType, arg.AmountMin, arg.CategoryIDs, arg.WalletID,
	)
	var column_1 int64
	err := row.Scan(&column_1)
	return column_1, err
}

const sumExpenseByWalletForUser = `-- name: SumExpenseByWalletForUser :many
SELECT t.wallet_id, w.name AS wallet_name, SUM(t.amount)::bigint AS amount
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = $2
  AND t.occurred_at >= $3::timestamptz
  AND t.occurred_at < $4::timestamptz
GROUP BY t.wallet_id, w.name
ORDER BY amount DESC, t.wallet_id
`

type SumExpenseByWalletForUserParams struct {
	UserID      uuid.UUID
	Currency    string
	WindowStart time.Time
	WindowEnd   time.Time
}

type SumExpenseByWalletForUserRow struct {
	WalletID   uuid.UUID
	WalletName string
	Amount     int64
}

// SumExpenseByWalletForUser backs Q8 (specs/ai-chat-query-spending/plan.md
// AIQ-T12).
func (q *Queries) SumExpenseByWalletForUser(ctx context.Context, arg SumExpenseByWalletForUserParams) ([]SumExpenseByWalletForUserRow, error) {
	rows, err := q.db.Query(ctx, sumExpenseByWalletForUser, arg.UserID, arg.Currency, arg.WindowStart, arg.WindowEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SumExpenseByWalletForUserRow
	for rows.Next() {
		var i SumExpenseByWalletForUserRow
		if err := rows.Scan(&i.WalletID, &i.WalletName, &i.Amount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const sumExpenseByLocalDay = `-- name: SumExpenseByLocalDay :many
SELECT (t.occurred_at AT TIME ZONE $1::text)::date AS day, SUM(t.amount)::bigint AS amount
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $2
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = $3
  AND t.occurred_at >= $4::timestamptz
  AND t.occurred_at < $5::timestamptz
  AND ($6::uuid[] IS NULL OR t.category_id = ANY($6::uuid[]))
GROUP BY day
ORDER BY day
`

type SumExpenseByLocalDayParams struct {
	Tz          string
	UserID      uuid.UUID
	Currency    string
	WindowStart time.Time
	WindowEnd   time.Time
	CategoryIDs []uuid.UUID
}

type SumExpenseByLocalDayRow struct {
	Day    time.Time
	Amount int64
}

// SumExpenseByLocalDay backs Q11/Q13 (specs/ai-chat-query-spending/plan.md
// AIQ-T12), bucketed by local day in the given timezone.
func (q *Queries) SumExpenseByLocalDay(ctx context.Context, arg SumExpenseByLocalDayParams) ([]SumExpenseByLocalDayRow, error) {
	rows, err := q.db.Query(ctx, sumExpenseByLocalDay,
		arg.Tz, arg.UserID, arg.Currency, arg.WindowStart, arg.WindowEnd, arg.CategoryIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SumExpenseByLocalDayRow
	for rows.Next() {
		var i SumExpenseByLocalDayRow
		if err := rows.Scan(&i.Day, &i.Amount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listTopCategoriesRecent = `-- name: ListTopCategoriesRecent :many
SELECT t.category_id, c.name AS category_name, c.type AS category_type, COUNT(*)::bigint AS tx_count
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND t.type <> 'transfer'
  AND t.occurred_at >= $2::timestamptz
GROUP BY t.category_id, c.name, c.type
ORDER BY tx_count DESC, t.category_id
LIMIT $3
`

type ListTopCategoriesRecentParams struct {
	UserID   uuid.UUID
	Since    time.Time
	RowLimit int32
}

type ListTopCategoriesRecentRow struct {
	CategoryID   uuid.UUID
	CategoryName string
	CategoryType string
	TxCount      int64
}

// ListTopCategoriesRecent backs the free-text Category context
// (specs/ai-chat-query-spending/plan.md AIQ-T35).
func (q *Queries) ListTopCategoriesRecent(ctx context.Context, arg ListTopCategoriesRecentParams) ([]ListTopCategoriesRecentRow, error) {
	rows, err := q.db.Query(ctx, listTopCategoriesRecent, arg.UserID, arg.Since, arg.RowLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListTopCategoriesRecentRow
	for rows.Next() {
		var i ListTopCategoriesRecentRow
		if err := rows.Scan(&i.CategoryID, &i.CategoryName, &i.CategoryType, &i.TxCount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
