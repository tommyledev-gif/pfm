-- "Anything unusual today/this week/this month?" (consult metric anomaly,
-- specs/ai-chat-query-spending, owner item 9). The figures are computed in Go
-- (service/analytics_anomaly*.go); this only lists the raw rows of the period
-- and its baseline, so every rule can bucket them by local day, week or cycle
-- without a query per bucket. Same conventions as analytics.sql: half-open
-- window resolved in Go in the app timezone, one currency through the wallet
-- join, soft-deleted Transactions excluded, user_id first. Kept in its own
-- file only because analytics.sql.go would pass 300 lines.

-- name: ListTransactionsInWindow :many
-- One type (expense or income) per call. Transfers never match: they are not
-- spending and not income, so they must not move a baseline. Newest first, so
-- when row_limit cuts the list it cuts the oldest baseline days, never the
-- period itself. No note column, as for every answer (plan.md BR-22).
SELECT
    t.id, t.amount, t.occurred_at, t.category_id,
    c.name AS category_name, w.name AS wallet_name
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = @user_id
  AND t.type = @tx_type
  AND t.type IN ('expense', 'income')
  AND t.deleted_at IS NULL
  AND w.currency = @currency
  AND t.occurred_at >= @window_start::timestamptz
  AND t.occurred_at < @window_end::timestamptz
  AND (sqlc.narg('category_ids')::uuid[] IS NULL OR t.category_id = ANY(sqlc.narg('category_ids')::uuid[]))
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR t.wallet_id = sqlc.narg('wallet_id'))
ORDER BY t.occurred_at DESC, t.id DESC
LIMIT @row_limit;
