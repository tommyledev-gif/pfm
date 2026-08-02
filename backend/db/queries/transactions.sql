-- name: CreateTransaction :one
INSERT INTO transactions (user_id, wallet_id, category_id, amount, type, note, occurred_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetTransactionByID :one
-- Deliberately NOT scoped by user_id, matching GetWalletByID/GetCategoryByID/
-- GetBudgetByID — the service layer decides 403 vs. 404. Joined with wallets/
-- categories for display names; the categories join is a plain JOIN, not
-- filtered on categories.deleted_at (specs/transaction-management/plan.md
-- Finding #6) — a soft-deleted category's row still exists, and its name must
-- still resolve for a historical Transaction (spec.md S-TRX-30).
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.id = $1
  AND t.deleted_at IS NULL
LIMIT 1;

-- name: ListTransactionsByUser :many
-- Cursor-paginated on occurred_at (not created_at — spec.md Edge Cases US-02
-- #1) with a matching id tie-break for equal timestamps. Every filter is an
-- optional sqlc.narg — a NULL narg leaves that AND clause a no-op.
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'))
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('type')::text IS NULL OR t.type = sqlc.narg('type'))
  AND (sqlc.narg('from_ts')::timestamptz IS NULL OR t.occurred_at >= sqlc.narg('from_ts'))
  AND (sqlc.narg('to_ts')::timestamptz IS NULL OR t.occurred_at <= sqlc.narg('to_ts'))
  AND (
    sqlc.narg('cursor_occurred_at')::timestamptz IS NULL
    OR t.occurred_at < sqlc.narg('cursor_occurred_at')
    OR (t.occurred_at = sqlc.narg('cursor_occurred_at') AND t.id < sqlc.narg('cursor_id'))
  )
ORDER BY t.occurred_at DESC, t.id DESC
LIMIT $2;

-- name: UpdateTransaction :one
-- Partial update via COALESCE, same convention as UpdateWallet/UpdateCategory.
-- wallet_id and type are never columns this query can touch — they aren't
-- request fields at all (dto.UpdateTransactionRequest has no such fields,
-- spec.md Context #5).
UPDATE transactions
SET
    amount      = COALESCE(sqlc.narg('amount'), amount),
    category_id = COALESCE(sqlc.narg('category_id'), category_id),
    occurred_at = COALESCE(sqlc.narg('occurred_at'), occurred_at),
    note        = COALESCE(sqlc.narg('note'), note),
    updated_at  = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTransaction :one
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: ExistsTransactionForWallet :one
-- Backs F-03's long-deferred 409 CURRENCY_LOCKED check (WAL-T14) — called
-- from WalletRepository, not TransactionRepository (cross-repository query
-- exception, specs/transaction-management/plan.md Security & Actor
-- Resolution — same pattern as F-05's ExistsActiveBudgetForCategory).
SELECT EXISTS (
    SELECT 1 FROM transactions
    WHERE wallet_id = $1
      AND deleted_at IS NULL
) AS exists;

-- name: SumExpenseByUserCurrentPeriod :many
-- Backs F-05's real spend computation (BUD-T17) — one aggregate query per
-- request, never N+1 (specs/budget-management/spec.md US-02 Edge Cases #1).
-- Called from BudgetRepository, not TransactionRepository (cross-repository
-- query exception). The current UTC calendar month is computed in SQL via
-- date_trunc so the app server and DB never disagree on "now"
-- (specs/budget-management/spec.md's resolved period-window decision).
SELECT
    t.category_id,
    w.currency,
    SUM(t.amount)::bigint AS spent
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND t.occurred_at >= date_trunc('month', NOW())
  AND t.occurred_at < date_trunc('month', NOW()) + INTERVAL '1 month'
GROUP BY t.category_id, w.currency;
