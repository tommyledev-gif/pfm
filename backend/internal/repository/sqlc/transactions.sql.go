package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const createTransaction = `-- name: CreateTransaction :one
INSERT INTO transactions (user_id, wallet_id, category_id, amount, type, note, occurred_at, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key
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
}

func (q *Queries) CreateTransaction(ctx context.Context, arg CreateTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, createTransaction,
		arg.UserID, arg.WalletID, arg.CategoryID, arg.Amount, arg.Type, arg.Note, arg.OccurredAt, arg.IdempotencyKey,
	)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
	)
	return i, err
}

const getTransactionByIdempotencyKey = `-- name: GetTransactionByIdempotencyKey :one
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.idempotency_key = $2
  AND t.deleted_at IS NULL
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
		&i.WalletName, &i.CategoryName,
	)
	return i, err
}

const getTransactionByID = `-- name: GetTransactionByID :one
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
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
		&i.WalletName, &i.CategoryName,
	)
	return i, err
}

const listTransactionsByUser = `-- name: ListTransactionsByUser :many
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND ($3::uuid IS NULL OR t.wallet_id = $3)
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
}

// ListTransactionsByUser is cursor-paginated on (occurred_at, created_at, id)
// — occurred_at is the primary sort key (specs/transaction-management/
// spec.md Edge Cases US-02 #1), created_at breaks ties for same-day
// transactions, id breaks any remaining tie.
func (q *Queries) ListTransactionsByUser(ctx context.Context, arg ListTransactionsByUserParams) ([]ListTransactionsByUserRow, error) {
	rows, err := q.db.Query(ctx, listTransactionsByUser,
		arg.UserID, arg.Limit, arg.WalletID, arg.CategoryID, arg.CategoryIDs, arg.Type,
		arg.FromTs, arg.ToTs, arg.Search, arg.CursorOccurredAt, arg.CursorCreatedAt, arg.CursorID,
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
			&i.WalletName, &i.CategoryName,
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
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND ($2::uuid IS NULL OR t.wallet_id = $2)
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
}

// CountTransactionsByUser is ListTransactionsByUser's WHERE clause without the
// cursor predicate or the LIMIT — the size of the whole filtered set, for the
// list response's `total`.
func (q *Queries) CountTransactionsByUser(ctx context.Context, arg CountTransactionsByUserParams) (int64, error) {
	row := q.db.QueryRow(ctx, countTransactionsByUser,
		arg.UserID, arg.WalletID, arg.CategoryID, arg.CategoryIDs, arg.Type,
		arg.FromTs, arg.ToTs, arg.Search,
	)
	var total int64
	err := row.Scan(&total)
	return total, err
}

const updateTransaction = `-- name: UpdateTransaction :one
UPDATE transactions
SET
    amount      = COALESCE($3, amount),
    category_id = COALESCE($4, category_id),
    occurred_at = COALESCE($5, occurred_at),
    note        = COALESCE($6, note),
    updated_at  = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *
`

type UpdateTransactionParams struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Amount     *int64
	CategoryID *uuid.UUID
	OccurredAt *time.Time
	Note       *string
}

// UpdateTransaction's query is RETURNING * (db/queries/transactions.sql) —
// the Scan below includes IdempotencyKey as the trailing column added by
// 010_transactions_idempotency_key.sql, even though this statement never
// touches that column itself.
func (q *Queries) UpdateTransaction(ctx context.Context, arg UpdateTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, updateTransaction,
		arg.ID, arg.UserID, arg.Amount, arg.CategoryID, arg.OccurredAt, arg.Note,
	)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
	)
	return i, err
}

const softDeleteTransaction = `-- name: SoftDeleteTransaction :one
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *
`

type SoftDeleteTransactionParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
}

// SoftDeleteTransaction's query is RETURNING * — same trailing-column note as
// UpdateTransaction above.
func (q *Queries) SoftDeleteTransaction(ctx context.Context, arg SoftDeleteTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, softDeleteTransaction, arg.ID, arg.UserID)
	var i Transaction
	err := row.Scan(
		&i.ID, &i.UserID, &i.WalletID, &i.CategoryID, &i.Amount, &i.Type,
		&i.Note, &i.OccurredAt, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.IdempotencyKey,
	)
	return i, err
}

const existsTransactionForWallet = `-- name: ExistsTransactionForWallet :one
SELECT EXISTS (
    SELECT 1 FROM transactions
    WHERE wallet_id = $1
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
