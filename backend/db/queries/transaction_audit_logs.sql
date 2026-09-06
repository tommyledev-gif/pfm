-- name: InsertAuditLog :one
-- Always executed inside TransactionService's existing DB transaction (the
-- same one carrying the wallet-balance mutation and the transaction row
-- write) — never on its own connection. Append-only: there is no
-- corresponding update/delete query in this file, by design.
INSERT INTO transaction_audit_logs (transaction_id, user_id, action, before, after)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, transaction_id, user_id, action, before, after, created_at;

-- name: ListAuditLogsByUser :many
-- Keyset pagination on (created_at, id) DESC — an audit entry's natural sort
-- is when it was written, so this reuses the generic {id, created_at} cursor
-- helper rather than Transaction's own occurred_at-keyed one.
-- $2 (transaction_id) is an optional filter; $3/$4 are the optional cursor.
SELECT id, transaction_id, user_id, action, before, after, created_at
FROM transaction_audit_logs
WHERE user_id = $1
  AND ($2::uuid IS NULL OR transaction_id = $2::uuid)
  AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
ORDER BY created_at DESC, id DESC
LIMIT $5;

-- name: CountAuditLogsByUser :one
SELECT COUNT(*)
FROM transaction_audit_logs
WHERE user_id = $1
  AND ($2::uuid IS NULL OR transaction_id = $2::uuid);
