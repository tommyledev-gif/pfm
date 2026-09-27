-- name: CreateTransaction :one
-- to_wallet_id ($9) is set only for a transfer (022_transaction_transfer.sql).
-- idempotency_key ($8) is nullable — every pre-existing caller omits it and
-- gets NULL, which the partial unique index (010_transactions_idempotency_key.sql)
-- never treats as a collision (specs/ai-chat-assistant/plan.md Finding #3).
INSERT INTO transactions (user_id, wallet_id, category_id, amount, type, note, occurred_at, idempotency_key, to_wallet_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id;

-- name: GetTransactionByIdempotencyKey :one
-- Backs the AI Chat confirm-step replay check (specs/ai-chat-assistant/spec.md
-- Resolved design decision #5, S-AI-13) — scoped by (user_id, idempotency_key)
-- so one caller can never observe another's key. Joined with wallets/categories
-- for the same reason GetTransactionByID is (display names), and uses the same
-- plain (non-deleted_at-filtered) categories join as GetTransactionByID
-- (Finding #6 precedent) so a replayed response never breaks on a since-deleted
-- category.
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name,
    t.to_wallet_id, tw.name AS to_wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
WHERE t.user_id = $1
  AND t.idempotency_key = $2
  AND t.deleted_at IS NULL
LIMIT 1;

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
    w.name AS wallet_name, c.name AS category_name,
    t.to_wallet_id, tw.name AS to_wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
WHERE t.id = $1
  AND t.deleted_at IS NULL
LIMIT 1;

-- name: ListTransactionsByUser :many
-- Cursor-paginated on (occurred_at, created_at, id) — occurred_at DESC
-- primary (spec.md Edge Cases US-02 #1), created_at DESC as the tie-break for
-- same-day transactions ("the actual moment the user approved it," not just
-- insertion id order), id DESC as the final tie-break for equal created_at.
-- Every filter is an optional sqlc.narg — a NULL narg leaves that AND clause
-- a no-op. category_ids is additive with category_id (both may be sent; in
-- practice callers send one or the other) — nil/empty slice is a no-op,
-- mirroring budget_limits' ANY(::uuid[]) precedent (db/queries/budgets.sql).
-- search is an ILIKE substring match against note only (the sole free-text
-- field on a transaction), with literal % / _ / \ pre-escaped by the caller
-- and matched via ESCAPE '\' so a note containing those characters can't be
-- misread as a wildcard.
SELECT
    t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.type, t.note,
    t.occurred_at, t.created_at, t.updated_at, t.deleted_at,
    w.name AS wallet_name, c.name AS category_name,
    t.to_wallet_id, tw.name AS to_wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id') OR t.to_wallet_id = sqlc.narg('wallet_id'))
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
  AND (sqlc.narg('type')::text IS NULL OR t.type = sqlc.narg('type'))
  AND (sqlc.narg('from_ts')::timestamptz IS NULL OR t.occurred_at >= sqlc.narg('from_ts'))
  AND (sqlc.narg('to_ts')::timestamptz IS NULL OR t.occurred_at <= sqlc.narg('to_ts'))
  AND (sqlc.narg('search')::text IS NULL OR t.note ILIKE '%' || sqlc.narg('search') || '%' ESCAPE '\')
  AND (
    sqlc.narg('cursor_occurred_at')::timestamptz IS NULL
    OR t.occurred_at < sqlc.narg('cursor_occurred_at')
    OR (t.occurred_at = sqlc.narg('cursor_occurred_at') AND t.created_at < sqlc.narg('cursor_created_at'))
    OR (
      t.occurred_at = sqlc.narg('cursor_occurred_at')
      AND t.created_at = sqlc.narg('cursor_created_at')
      AND t.id < sqlc.narg('cursor_id')
    )
  )
ORDER BY t.occurred_at DESC, t.created_at DESC, t.id DESC
LIMIT $2;

-- name: CountTransactionsByUser :one
-- Total rows matching the same filters ListTransactionsByUser applies, minus
-- the cursor clause (a cursor narrows the page, not the result set) and the
-- LIMIT. Backs the Transactions screen's "N mục" header badge, which needs
-- the size of the whole filtered set — the page it renders is capped at
-- common.DefaultListLimit, so counting what was fetched reported a constant
-- 20 no matter which filters were on.
--
-- The wallets/categories JOINs are kept even though no column from either is
-- selected: both are INNER JOINs, so dropping them would silently widen the
-- count relative to the list whenever a row's wallet or category is missing.
SELECT COUNT(*)::bigint
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id') OR t.to_wallet_id = sqlc.narg('wallet_id'))
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
  AND (sqlc.narg('type')::text IS NULL OR t.type = sqlc.narg('type'))
  AND (sqlc.narg('from_ts')::timestamptz IS NULL OR t.occurred_at >= sqlc.narg('from_ts'))
  AND (sqlc.narg('to_ts')::timestamptz IS NULL OR t.occurred_at <= sqlc.narg('to_ts'))
  AND (sqlc.narg('search')::text IS NULL OR t.note ILIKE '%' || sqlc.narg('search') || '%' ESCAPE '\');

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
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id;

-- name: SoftDeleteTransaction :one
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, wallet_id, category_id, amount, type, note, occurred_at, created_at, updated_at, deleted_at, idempotency_key, to_wallet_id;

-- name: ExistsTransactionForWallet :one
-- Backs F-03's long-deferred 409 CURRENCY_LOCKED check (WAL-T14) — called
-- from WalletRepository, not TransactionRepository (cross-repository query
-- exception, specs/transaction-management/plan.md Security & Actor
-- Resolution — same pattern as F-05's ExistsActiveBudgetForCategory).
SELECT EXISTS (
    SELECT 1 FROM transactions
    WHERE (wallet_id = $1 OR to_wallet_id = $1)
      AND deleted_at IS NULL
) AS exists;

-- name: SumReportTotalsByUser :many
-- Backs F-07's per-currency totals aggregate (specs/financial-reporting/plan.md
-- RPT-T1) — one query per request, grouped by (type, currency), over an
-- arbitrary caller-supplied window (from_ts/to_ts always resolved by
-- ReportService before this runs — plan.md Finding #6), unlike
-- SumExpenseByUserCycle's fixed cycle-window/expense-only scope.
-- Every filter beyond the window is an optional sqlc.narg — a NULL narg
-- leaves that AND clause a no-op (same convention as ListTransactionsByUser).
-- Ordered by currency for a deterministic response (plan.md Finding #9).
SELECT
    t.type,
    w.currency,
    SUM(t.amount)::bigint AS total
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND t.occurred_at >= sqlc.arg('from_ts')
  AND t.occurred_at <= sqlc.arg('to_ts')
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'))
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('type')::text IS NULL OR t.type = sqlc.narg('type'))
  AND t.type <> 'transfer'
GROUP BY t.type, w.currency
ORDER BY w.currency ASC;

-- name: SumReportByCategoryForUser :many
-- Backs F-07's by_category aggregate (specs/financial-reporting/plan.md
-- RPT-T1) — grouped by (category_id, category_name, type, currency), ordered
-- amount DESC (spec.md Response Shape). The categories join is a plain JOIN,
-- never filtered on categories.deleted_at (spec.md S-RPT-10) — same precedent
-- as GetTransactionByID, so a historical Transaction's category name still
-- resolves even after that Category is soft-deleted.
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
  AND t.occurred_at >= sqlc.arg('from_ts')
  AND t.occurred_at <= sqlc.arg('to_ts')
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'))
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('type')::text IS NULL OR t.type = sqlc.narg('type'))
  AND t.type <> 'transfer'
GROUP BY t.category_id, c.name, t.type, w.currency
ORDER BY amount DESC;

-- name: SumExpenseByUserCycle :many
-- Backs F-05's real spend computation (BUD-T17) and F-10's budget job — one
-- aggregate query per request, never N+1 (specs/budget-management/spec.md
-- US-02 Edge Cases #1). Called from BudgetRepository, not
-- TransactionRepository (cross-repository query exception). The window is a
-- half-open [cycle_start, cycle_end) resolved in Go by
-- service.ResolveCycleWindow in the app timezone
-- (specs/ai-budget-wizard-v2/spec.md US-03) — replaces the old UTC
-- date_trunc('month', NOW()) window.
SELECT
    t.category_id,
    w.currency,
    SUM(t.amount)::bigint AS spent
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = @user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND t.occurred_at >= @cycle_start::timestamptz
  AND t.occurred_at < @cycle_end::timestamptz
GROUP BY t.category_id, w.currency;
