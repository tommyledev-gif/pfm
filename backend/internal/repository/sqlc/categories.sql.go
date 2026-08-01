package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const createCategory = `-- name: CreateCategory :one
INSERT INTO categories (user_id, name, icon, type)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, name, icon, type, created_at, deleted_at
`

type CreateCategoryParams struct {
	UserID *uuid.UUID
	Name   string
	Icon   *string
	Type   string
}

func (q *Queries) CreateCategory(ctx context.Context, arg CreateCategoryParams) (Category, error) {
	row := q.db.QueryRow(ctx, createCategory, arg.UserID, arg.Name, arg.Icon, arg.Type)
	var i Category
	err := row.Scan(&i.ID, &i.UserID, &i.Name, &i.Icon, &i.Type, &i.CreatedAt, &i.DeletedAt)
	return i, err
}

const nameTypeExists = `-- name: NameTypeExists :one
SELECT EXISTS (
    SELECT 1 FROM categories
    WHERE (user_id IS NULL OR user_id = $1)
      AND lower(name) = lower($2)
      AND type = $3
      AND deleted_at IS NULL
      AND id != COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid)
) AS "exists"
`

type NameTypeExistsParams struct {
	UserID    uuid.UUID
	Name      string
	Type      string
	ExcludeID *uuid.UUID
}

func (q *Queries) NameTypeExists(ctx context.Context, arg NameTypeExistsParams) (bool, error) {
	row := q.db.QueryRow(ctx, nameTypeExists, arg.UserID, arg.Name, arg.Type, arg.ExcludeID)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

const listCategoriesForUser = `-- name: ListCategoriesForUser :many
SELECT id, user_id, name, icon, type, created_at, deleted_at FROM categories
WHERE (user_id IS NULL OR user_id = $1)
  AND ($2::text IS NULL OR type = $2)
  AND deleted_at IS NULL
ORDER BY (user_id IS NULL) DESC, name ASC
`

type ListCategoriesForUserParams struct {
	UserID uuid.UUID
	Type   *string
}

func (q *Queries) ListCategoriesForUser(ctx context.Context, arg ListCategoriesForUserParams) ([]Category, error) {
	rows, err := q.db.Query(ctx, listCategoriesForUser, arg.UserID, arg.Type)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Category
	for rows.Next() {
		var i Category
		if err := rows.Scan(&i.ID, &i.UserID, &i.Name, &i.Icon, &i.Type, &i.CreatedAt, &i.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getCategoryByID = `-- name: GetCategoryByID :one
SELECT id, user_id, name, icon, type, created_at, deleted_at FROM categories
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1
`

// GetCategoryByID is deliberately not scoped by user_id — see db/queries/categories.sql.
func (q *Queries) GetCategoryByID(ctx context.Context, id uuid.UUID) (Category, error) {
	row := q.db.QueryRow(ctx, getCategoryByID, id)
	var i Category
	err := row.Scan(&i.ID, &i.UserID, &i.Name, &i.Icon, &i.Type, &i.CreatedAt, &i.DeletedAt)
	return i, err
}

const updateCategory = `-- name: UpdateCategory :one
UPDATE categories
SET
    name = COALESCE($3, name),
    icon = COALESCE($4, icon)
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, name, icon, type, created_at, deleted_at
`

type UpdateCategoryParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Name   *string
	Icon   *string
}

func (q *Queries) UpdateCategory(ctx context.Context, arg UpdateCategoryParams) (Category, error) {
	row := q.db.QueryRow(ctx, updateCategory, arg.ID, arg.UserID, arg.Name, arg.Icon)
	var i Category
	err := row.Scan(&i.ID, &i.UserID, &i.Name, &i.Icon, &i.Type, &i.CreatedAt, &i.DeletedAt)
	return i, err
}

const softDeleteCategory = `-- name: SoftDeleteCategory :one
UPDATE categories
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, name, icon, type, created_at, deleted_at
`

func (q *Queries) SoftDeleteCategory(ctx context.Context, id uuid.UUID, userID uuid.UUID) (Category, error) {
	row := q.db.QueryRow(ctx, softDeleteCategory, id, userID)
	var i Category
	err := row.Scan(&i.ID, &i.UserID, &i.Name, &i.Icon, &i.Type, &i.CreatedAt, &i.DeletedAt)
	return i, err
}
