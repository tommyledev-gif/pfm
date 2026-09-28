-- Feature-12 US-03 Query Spending via Chat (specs/ai-chat-query-spending/,
-- plan.md AIQ-T12). Read-only aggregates the report queries in
-- transactions.sql cannot answer. Every window is half-open
-- [window_start, window_end), resolved in Go by service.ResolveCycleWindow
-- in the app timezone — no date_trunc here (plan.md BR-03). Every query
-- filters one currency via the wallet join (plan.md BR-04) and excludes
-- soft-deleted Transactions (BR-10). user_id is always the first predicate.

-- name: ListExpensesByAmount :many
-- Q5 top-N, Q6 above-a-threshold, Q14 single largest. Deliberately no note
-- column: answers never carry Transaction notes (plan.md BR-22).
SELECT
    t.id, t.amount, t.occurred_at, t.category_id, t.wallet_id,
    c.name AS category_name, w.name AS wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = @user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = @currency
  AND t.occurred_at >= @window_start::timestamptz
  AND t.occurred_at < @window_end::timestamptz
  AND (sqlc.narg('amount_min')::bigint IS NULL OR t.amount >= sqlc.narg('amount_min'))
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'))
ORDER BY t.amount DESC, t.occurred_at DESC, t.id DESC
LIMIT @row_limit;

-- name: CountTransactionsInWindow :one
-- tx_count on every answer, and total_matched for bounded lists
-- (plan.md F9, BR-12). tx_type NULL counts both income and expense.
SELECT COUNT(*)::bigint
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = @user_id
  AND t.deleted_at IS NULL
  AND w.currency = @currency
  AND t.occurred_at >= @window_start::timestamptz
  AND t.occurred_at < @window_end::timestamptz
  AND (sqlc.narg('tx_type')::text IS NULL OR t.type = sqlc.narg('tx_type'))
  AND t.type <> 'transfer'
  AND (sqlc.narg('amount_min')::bigint IS NULL OR t.amount >= sqlc.narg('amount_min'))
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'));

-- name: SumExpenseByWalletForUser :many
-- Q8 breakdown by Wallet.
SELECT t.wallet_id, w.name AS wallet_name, SUM(t.amount)::bigint AS amount
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = @user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = @currency
  AND t.occurred_at >= @window_start::timestamptz
  AND t.occurred_at < @window_end::timestamptz
GROUP BY t.wallet_id, w.name
ORDER BY amount DESC, t.wallet_id;

-- name: SumExpenseByLocalDay :many
-- Q11 average per day (days with spending only, plan.md BR-08) and Q13
-- weekday breakdown. Days are bucketed in the app timezone, passed as tz,
-- so a 00:30 local expense lands on its local day.
SELECT (t.occurred_at AT TIME ZONE @tz::text)::date AS day, SUM(t.amount)::bigint AS amount
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = @user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND w.currency = @currency
  AND t.occurred_at >= @window_start::timestamptz
  AND t.occurred_at < @window_end::timestamptz
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
GROUP BY day
ORDER BY day;

-- name: ListTopCategoriesRecent :many
-- Category context for free-text interpretation (plan.md AIQ-T35, brief
-- §II.8.1): the caller's most-used expense Categories since a cutoff, by
-- Transaction count. Deleted Categories are excluded — the model must never
-- be offered one to pick.
SELECT t.category_id, c.name AS category_name, c.type AS category_type, COUNT(*)::bigint AS tx_count
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = @user_id
  AND t.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND t.type <> 'transfer'
  AND t.occurred_at >= @since::timestamptz
GROUP BY t.category_id, c.name, c.type
ORDER BY tx_count DESC, t.category_id
LIMIT @row_limit;
