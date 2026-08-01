-- name: CreateWallet :one
INSERT INTO wallets (user_id, name, type, balance, currency, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CountWalletsByUser :one
SELECT COUNT(*) FROM wallets
WHERE user_id = $1
  AND deleted_at IS NULL;

-- name: ClearDefaultWallet :exec
-- Clears whichever wallet currently holds the default flag for this user, if
-- any. Affecting zero rows (no current default) is not an error — it is the
-- expected outcome for a user's very first wallet.
UPDATE wallets
SET is_default = false, updated_at = NOW()
WHERE user_id = $1
  AND is_default = true
  AND deleted_at IS NULL;

-- name: ListWalletsByUser :many
SELECT * FROM wallets
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY is_default DESC, created_at ASC;

-- name: GetWalletByID :one
-- Deliberately NOT scoped by user_id, unlike every other query here — the
-- service layer must see the row first to decide 403 vs. 404 (spec.md).
-- Never expose this query's result to a caller without that check.
SELECT * FROM wallets
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1;

-- name: UpdateWallet :one
UPDATE wallets
SET
    name       = COALESCE(sqlc.narg('name'), name),
    type       = COALESCE(sqlc.narg('type'), type),
    updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: SetDefaultWallet :one
UPDATE wallets
SET is_default = true, updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;
