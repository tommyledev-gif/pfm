-- name: CreateBudget :one
INSERT INTO budgets (user_id, category_id, period, start_date, icon, icon_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: InsertBudgetLimit :exec
-- One row per currency; called once per entry in the caller's `limits` map,
-- inside the same transaction as CreateBudget/ReplaceBudgetLimits — never a
-- standalone write (specs/budget-management/plan.md Finding #4/#9).
INSERT INTO budget_limits (budget_id, currency, amount_limit)
VALUES ($1, $2, $3);

-- name: DeleteBudgetLimits :exec
-- Full-replace semantics for PATCH (spec.md Edge Case US-04 #1, plan.md
-- Finding #9): delete every existing currency row for this Budget, then the
-- caller re-inserts exactly what was submitted, all inside one transaction.
DELETE FROM budget_limits WHERE budget_id = $1;

-- name: ListBudgetLimitsByBudgetIDs :many
SELECT * FROM budget_limits
WHERE budget_id = ANY(sqlc.arg(budget_ids)::uuid[]);

-- name: ListBudgetsByUser :many
SELECT b.*, c.name AS category_name
FROM budgets b
JOIN categories c ON c.id = b.category_id
WHERE b.user_id = $1
  AND b.deleted_at IS NULL
ORDER BY b.created_at ASC;

-- name: GetBudgetByID :one
-- Deliberately NOT scoped by user_id, same precedent as GetWalletByID/
-- GetCategoryByID — the service layer decides 403 vs. 404. Also reused as
-- the ownership-check step before Update/Delete (spec.md 403/404 split).
SELECT b.*, c.name AS category_name
FROM budgets b
JOIN categories c ON c.id = b.category_id
WHERE b.id = $1
  AND b.deleted_at IS NULL
LIMIT 1;

-- name: ExistsActiveBudgetForCategory :one
-- Used by CategoryRepository (F-04 amendment) to back the 409
-- CATEGORY_IN_USE delete guard (spec.md S-CAT-27) — not scoped by user_id
-- because a private category can only ever be referenced by its own owner's
-- Budgets (Budget creation's own visibility check already enforces that).
SELECT EXISTS (
    SELECT 1 FROM budgets
    WHERE category_id = $1
      AND deleted_at IS NULL
) AS "exists";

-- name: UpdateBudgetFields :one
-- Updates a Budget's icon/icon_url (independent of `limits`, which has its
-- own full-replace path via ReplaceBudgetLimits) and always bumps
-- updated_at — supersedes the narrower TouchBudgetUpdatedAt this replaced,
-- since every Update now needs an updated_at bump regardless of which
-- fields changed. Scoped by id + user_id as a redundant ownership guard,
-- though the caller must already have verified ownership via GetBudgetByID
-- first. icon_url uses the same presence-flag CASE as UpdateWallet
-- (specs/wallet-budget-icons/plan.md Finding #1) — not COALESCE, so an
-- explicit `null` can actually clear a previously set photo.
UPDATE budgets
SET
    icon             = COALESCE(sqlc.narg('icon'), icon),
    icon_url         = CASE WHEN sqlc.arg('icon_url_provided')::bool THEN sqlc.narg('icon_url') ELSE icon_url END,
    updated_at       = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteBudget :one
UPDATE budgets
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: ListDistinctUserIDsWithActiveBudgets :many
-- Backs F-10's background job (specs/notification-handling/plan.md Finding
-- #1) — the job loops this list, calling ListBudgetsByUser/
-- SpentByUserCurrentPeriod per user, rather than a single global aggregate
-- query. Only this feature's own table (budgets) is touched, so this is not
-- a cross-repository query exception.
SELECT DISTINCT user_id FROM budgets
WHERE deleted_at IS NULL;
