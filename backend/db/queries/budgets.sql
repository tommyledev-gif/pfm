-- name: CreateBudget :one
INSERT INTO budgets (user_id, category_id, period, start_date)
VALUES ($1, $2, $3, $4)
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

-- name: TouchBudgetUpdatedAt :exec
-- Bumps updated_at when only the child budget_limits rows changed (US-04
-- step 5) — scoped by id + user_id as a redundant ownership guard, though
-- the caller must already have verified ownership via GetBudgetByID first.
UPDATE budgets
SET updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL;

-- name: SoftDeleteBudget :one
UPDATE budgets
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;
