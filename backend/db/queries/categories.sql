-- name: CreateCategory :one
INSERT INTO categories (user_id, name, icon, type, icon_url)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: NameTypeExists :one
-- Cross-scope duplicate check (system OR caller's own) used by both Create
-- and rename-on-Update (specs/category-management/plan.md Finding #3/#10).
-- exclude_id lets Update ignore the category's own current row when the name
-- isn't actually changing identity; Create passes it as NULL (no exclusion).
SELECT EXISTS (
    SELECT 1 FROM categories
    WHERE (user_id IS NULL OR user_id = $1)
      AND lower(name) = lower($2)
      AND type = $3
      AND deleted_at IS NULL
      AND id != COALESCE(sqlc.narg('exclude_id'), '00000000-0000-0000-0000-000000000000'::uuid)
) AS "exists";

-- name: ListCategoriesForUser :many
-- Returns system categories (user_id IS NULL) plus the caller's own,
-- optionally filtered by type. System categories first, then the caller's
-- own, alphabetically within each group (spec.md US-02 Main Flow).
SELECT * FROM categories
WHERE (user_id IS NULL OR user_id = $1)
  AND (sqlc.narg('type')::text IS NULL OR type = sqlc.narg('type'))
  AND deleted_at IS NULL
ORDER BY (user_id IS NULL) DESC, name ASC;

-- name: GetCategoryByID :one
-- Deliberately NOT scoped by user_id, like GetWalletByID — the service layer
-- decides visibility (system/own/other-user) and 403 vs. 404.
SELECT * FROM categories
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1;

-- name: UpdateCategory :one
-- Scoped by user_id = caller — a system category (user_id IS NULL) or
-- another user's category can never match this WHERE clause, so it always
-- returns pgx.ErrNoRows for those cases (ownership already verified earlier
-- by the service via getOwnedCategory before this is ever called).
UPDATE categories
SET
    name = COALESCE(sqlc.narg('name'), name),
    icon = COALESCE(sqlc.narg('icon'), icon),
    icon_url = COALESCE(sqlc.narg('icon_url'), icon_url)
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteCategory :one
UPDATE categories
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING *;

-- name: LockCategoryByID :one
-- Row lock (specs/budget-management/plan.md Finding #2/#3): takes a
-- SELECT ... FOR UPDATE on the category row inside the caller's transaction.
-- Used by BOTH BudgetRepository (create-time category validation) and
-- CategoryRepository (delete-time active-Budget check) so the two
-- operations serialize on the same row instead of racing (spec.md
-- S-BUD-14 / S-CAT-32). Deliberately not scoped by user_id or deleted_at —
-- the caller decides existence/visibility/type after inspecting the row.
SELECT * FROM categories
WHERE id = $1
LIMIT 1
FOR UPDATE;
