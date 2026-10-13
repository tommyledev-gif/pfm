-- Items and Adjustments of a Transaction (specs/transaction-line-items/).
-- Every query is scoped by user_id (CLAUDE.md user-isolation rule) and reads
-- only active lines (deleted_at IS NULL).

-- name: InsertTransactionLine :exec
INSERT INTO transaction_lines (transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: ListActiveLinesByTransaction :many
SELECT id, transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount, created_at, deleted_at
FROM transaction_lines
WHERE transaction_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY position, id;

-- name: ListActiveLinesByTransactionIDs :many
-- Backs the export's Items sheet: every active line of the exported page in
-- one query instead of one per Transaction.
SELECT id, transaction_id, user_id, position, kind, sign, name, quantity, unit_price, amount, created_at, deleted_at
FROM transaction_lines
WHERE user_id = $1
  AND transaction_id = ANY($2::uuid[])
  AND deleted_at IS NULL
ORDER BY transaction_id, position, id;

-- name: SoftDeleteActiveLinesByTransaction :exec
-- An edit replaces the whole list (spec BR-11): the old lines are retired,
-- never erased, so the history keeps them (BR-12).
UPDATE transaction_lines
SET deleted_at = NOW()
WHERE transaction_id = $1
  AND user_id = $2
  AND deleted_at IS NULL;

-- name: CountActiveItemsByTransactionIDs :many
-- One query per list page for the Item-count marker (plan F4). Adjustments
-- are not counted.
SELECT transaction_id, COUNT(*)::int AS item_count
FROM transaction_lines
WHERE user_id = $1
  AND transaction_id = ANY($2::uuid[])
  AND kind = 'item'
  AND deleted_at IS NULL
GROUP BY transaction_id;

-- name: LockTransactionForUpdate :one
-- Row lock taken inside UpdateTransaction's tx before the balance rule and the
-- stale-edit check run (plan F1, F17), so two concurrent edits can never both
-- pass a check against a state the other is about to overwrite. wallet_id is
-- read under the lock too: a wallet move reverses the effect on the Wallet
-- the row is on NOW, not the one a pre-tx read saw.
SELECT amount, updated_at, wallet_id
FROM transactions
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
FOR UPDATE;
