package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const sumReportTotalsByUser = `-- name: SumReportTotalsByUser :many
SELECT
    t.type,
    w.currency,
    SUM(t.amount)::bigint AS total
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND t.occurred_at >= $2
  AND t.occurred_at <= $3
  AND ($4::uuid IS NULL OR t.wallet_id = $4)
  AND ($5::uuid IS NULL OR t.category_id = $5)
  AND ($6::text IS NULL OR t.type = $6)
  AND t.type <> 'transfer'
GROUP BY t.type, w.currency
ORDER BY w.currency ASC
`

type SumReportTotalsByUserParams struct {
	UserID     uuid.UUID
	FromTs     time.Time
	ToTs       time.Time
	WalletID   *uuid.UUID
	CategoryID *uuid.UUID
	Type       *string
}

type SumReportTotalsByUserRow struct {
	Type     string
	Currency string
	Total    int64
}

// SumReportTotalsByUser backs F-07's per-currency totals aggregate
// (specs/financial-reporting/plan.md RPT-T1) — one query per request, grouped
// by (type, currency), over an arbitrary caller-supplied window (from_ts/
// to_ts always resolved by ReportService before this runs — plan.md Finding
// #6), unlike SumExpenseByUserCycle's fixed cycle-window/
// expense-only scope. Ordered by currency for a deterministic response
// (plan.md Finding #9).
func (q *Queries) SumReportTotalsByUser(ctx context.Context, arg SumReportTotalsByUserParams) ([]SumReportTotalsByUserRow, error) {
	rows, err := q.db.Query(ctx, sumReportTotalsByUser,
		arg.UserID, arg.FromTs, arg.ToTs, arg.WalletID, arg.CategoryID, arg.Type,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SumReportTotalsByUserRow
	for rows.Next() {
		var i SumReportTotalsByUserRow
		if err := rows.Scan(&i.Type, &i.Currency, &i.Total); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const sumReportByCategoryForUser = `-- name: SumReportByCategoryForUser :many
SELECT
    t.category_id,
    c.name AS category_name,
    t.type,
    w.currency,
    SUM(t.amount)::bigint AS amount
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND t.occurred_at >= $2
  AND t.occurred_at <= $3
  AND ($4::uuid IS NULL OR t.wallet_id = $4)
  AND ($5::uuid IS NULL OR t.category_id = $5)
  AND ($6::text IS NULL OR t.type = $6)
  AND t.type <> 'transfer'
GROUP BY t.category_id, c.name, t.type, w.currency
ORDER BY amount DESC
`

type SumReportByCategoryForUserParams struct {
	UserID     uuid.UUID
	FromTs     time.Time
	ToTs       time.Time
	WalletID   *uuid.UUID
	CategoryID *uuid.UUID
	Type       *string
}

type SumReportByCategoryForUserRow struct {
	CategoryID   uuid.UUID
	CategoryName string
	Type         string
	Currency     string
	Amount       int64
}

// SumReportByCategoryForUser backs F-07's by_category aggregate
// (specs/financial-reporting/plan.md RPT-T1) — grouped by (category_id,
// category_name, type, currency), ordered amount DESC (spec.md Response
// Shape). The categories join is a plain JOIN, never filtered on
// categories.deleted_at (spec.md S-RPT-10) — same precedent as
// GetTransactionByID, so a historical Transaction's category name still
// resolves even after that Category is soft-deleted.
func (q *Queries) SumReportByCategoryForUser(ctx context.Context, arg SumReportByCategoryForUserParams) ([]SumReportByCategoryForUserRow, error) {
	rows, err := q.db.Query(ctx, sumReportByCategoryForUser,
		arg.UserID, arg.FromTs, arg.ToTs, arg.WalletID, arg.CategoryID, arg.Type,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SumReportByCategoryForUserRow
	for rows.Next() {
		var i SumReportByCategoryForUserRow
		if err := rows.Scan(&i.CategoryID, &i.CategoryName, &i.Type, &i.Currency, &i.Amount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const sumExpenseByUserCycle = `-- name: SumExpenseByUserCycle :many
SELECT
    t.category_id,
    w.currency,
    SUM(t.amount)::bigint AS spent
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND t.occurred_at >= $2::timestamptz
  AND t.occurred_at < $3::timestamptz
GROUP BY t.category_id, w.currency
`

type SumExpenseByUserCycleParams struct {
	UserID     uuid.UUID
	CycleStart time.Time
	CycleEnd   time.Time
}

type SumExpenseByUserCycleRow struct {
	CategoryID uuid.UUID
	Currency   string
	Spent      int64
}

// SumExpenseByUserCycle backs F-05's real spend computation (BUD-T17) and
// F-10's budget job — called from BudgetRepository via the shared *Queries
// struct (cross-repository query exception). The half-open window is
// resolved in Go by service.ResolveCycleWindow
// (specs/ai-budget-wizard-v2/spec.md US-03).
func (q *Queries) SumExpenseByUserCycle(ctx context.Context, arg SumExpenseByUserCycleParams) ([]SumExpenseByUserCycleRow, error) {
	rows, err := q.db.Query(ctx, sumExpenseByUserCycle, arg.UserID, arg.CycleStart, arg.CycleEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SumExpenseByUserCycleRow
	for rows.Next() {
		var i SumExpenseByUserCycleRow
		if err := rows.Scan(&i.CategoryID, &i.Currency, &i.Spent); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
