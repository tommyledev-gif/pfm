-- name: CreateSpendingIntention :one
-- One row per saved intention card. idempotency_key is the card's own id: the
-- service looks it up first (GetSpendingIntentionByKey), the unique index is
-- the guard for two saves racing.
INSERT INTO spending_intentions (
    user_id, title, kind, category_id, currency, total_amount, monthly_amount,
    installment_months, target_month, note, idempotency_key
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetSpendingIntentionByID :one
-- Own, not deleted. A foreign or deleted id matches nothing, which the
-- service reports as not found.
SELECT * FROM spending_intentions
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: GetSpendingIntentionByKey :one
-- Deliberately includes deleted rows: a card saved, deleted, then saved again
-- must be told so, not insert a second row with the same key.
SELECT * FROM spending_intentions
WHERE user_id = $1 AND idempotency_key = $2;

-- name: ListSpendingIntentionsByUser :many
-- Soonest month first, then oldest first: the order of the list, and the order
-- every "other intentions of the month" sum reads them in.
SELECT * FROM spending_intentions
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY target_month ASC, created_at ASC;

-- name: CountSpendingIntentionsByUser :one
SELECT COUNT(*) FROM spending_intentions
WHERE user_id = $1 AND deleted_at IS NULL;

-- name: UpdateSpendingIntention :one
-- Replaces the whole editable set. idempotency_key never changes.
UPDATE spending_intentions
SET title = $3, kind = $4, category_id = $5, currency = $6, total_amount = $7,
    monthly_amount = $8, installment_months = $9, target_month = $10, note = $11,
    updated_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteSpendingIntention :execrows
UPDATE spending_intentions
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
