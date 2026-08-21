-- name: CreateWallet :one
INSERT INTO wallets (user_id, name, type, balance, currency, is_default, icon, icon_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
-- currency is only ever a real change once WalletService has confirmed the
-- 409 CURRENCY_LOCKED check passes (specs/transaction-management/plan.md
-- Finding #2 / WAL-T14) — this query itself applies the COALESCE
-- unconditionally, trusting that gate. icon_url uses a presence-flag CASE,
-- not COALESCE, so an explicit `null` can actually clear a previously set
-- photo — COALESCE(sqlc.narg('icon_url'), icon_url) would silently keep the
-- old value forever once set (specs/wallet-budget-icons/plan.md Finding #1;
-- icon itself keeps the simpler COALESCE convention, matching categories.icon
-- — no spec requires explicit emoji-clearing).
UPDATE wallets
SET
    name             = COALESCE(sqlc.narg('name'), name),
    type             = COALESCE(sqlc.narg('type'), type),
    currency         = COALESCE(sqlc.narg('currency'), currency),
    icon             = COALESCE(sqlc.narg('icon'), icon),
    icon_url         = CASE WHEN sqlc.arg('icon_url_provided')::bool THEN sqlc.narg('icon_url') ELSE icon_url END,
    updated_at       = NOW()
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

-- name: DecrementWalletBalanceIfSufficient :one
-- Backs the insufficient-balance floor for expense Transaction creation
-- (specs/transaction-management/spec.md Context #4, S-TRX-09/S-TRX-18) — the
-- WHERE balance >= $2 clause IS the concurrency guard: zero rows returned
-- (pgx.ErrNoRows) is the authoritative INSUFFICIENT_BALANCE signal, closing
-- the race between two concurrent expense requests without a separate
-- SELECT ... FOR UPDATE lock. Only ever called from POST /transactions — see
-- AdjustWalletBalance below for the unconditional, floor-free variant used by
-- Update/Delete.
UPDATE wallets
SET balance = balance - $2, updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
  AND balance >= $2
RETURNING *;

-- name: AdjustWalletBalance :one
-- Unconditional signed-delta balance adjustment — no floor check, deliberately
-- (specs/transaction-management/spec.md Context #3): used for income Transaction
-- creation (positive delta) and for every Update/Delete balance reconciliation
-- (positive or negative delta), where the resulting balance is allowed to land
-- at zero or below. Never used for expense Transaction creation — that goes
-- through DecrementWalletBalanceIfSufficient instead.
UPDATE wallets
SET balance = balance + $2, updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *;
