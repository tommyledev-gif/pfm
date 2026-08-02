package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const createBudget = `-- name: CreateBudget :one
INSERT INTO budgets (user_id, category_id, period, start_date)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, category_id, period, start_date, created_at, updated_at, deleted_at
`

type CreateBudgetParams struct {
	UserID     uuid.UUID
	CategoryID uuid.UUID
	Period     string
	StartDate  time.Time
}

func (q *Queries) CreateBudget(ctx context.Context, arg CreateBudgetParams) (Budget, error) {
	row := q.db.QueryRow(ctx, createBudget, arg.UserID, arg.CategoryID, arg.Period, arg.StartDate)
	var i Budget
	err := row.Scan(&i.ID, &i.UserID, &i.CategoryID, &i.Period, &i.StartDate, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt)
	return i, err
}

const insertBudgetLimit = `-- name: InsertBudgetLimit :exec
INSERT INTO budget_limits (budget_id, currency, amount_limit)
VALUES ($1, $2, $3)
`

type InsertBudgetLimitParams struct {
	BudgetID    uuid.UUID
	Currency    string
	AmountLimit int64
}

func (q *Queries) InsertBudgetLimit(ctx context.Context, arg InsertBudgetLimitParams) error {
	_, err := q.db.Exec(ctx, insertBudgetLimit, arg.BudgetID, arg.Currency, arg.AmountLimit)
	return err
}

const deleteBudgetLimits = `-- name: DeleteBudgetLimits :exec
DELETE FROM budget_limits WHERE budget_id = $1
`

func (q *Queries) DeleteBudgetLimits(ctx context.Context, budgetID uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteBudgetLimits, budgetID)
	return err
}

const listBudgetLimitsByBudgetIDs = `-- name: ListBudgetLimitsByBudgetIDs :many
SELECT budget_id, currency, amount_limit FROM budget_limits
WHERE budget_id = ANY($1::uuid[])
`

func (q *Queries) ListBudgetLimitsByBudgetIDs(ctx context.Context, budgetIDs []uuid.UUID) ([]BudgetLimit, error) {
	rows, err := q.db.Query(ctx, listBudgetLimitsByBudgetIDs, budgetIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []BudgetLimit
	for rows.Next() {
		var i BudgetLimit
		if err := rows.Scan(&i.BudgetID, &i.Currency, &i.AmountLimit); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listBudgetsByUser = `-- name: ListBudgetsByUser :many
SELECT b.id, b.user_id, b.category_id, b.period, b.start_date, b.created_at, b.updated_at, b.deleted_at, c.name AS category_name
FROM budgets b
JOIN categories c ON c.id = b.category_id
WHERE b.user_id = $1
  AND b.deleted_at IS NULL
ORDER BY b.created_at ASC
`

type ListBudgetsByUserRow struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	CategoryID   uuid.UUID
	Period       string
	StartDate    time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
	CategoryName string
}

func (q *Queries) ListBudgetsByUser(ctx context.Context, userID uuid.UUID) ([]ListBudgetsByUserRow, error) {
	rows, err := q.db.Query(ctx, listBudgetsByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ListBudgetsByUserRow
	for rows.Next() {
		var i ListBudgetsByUserRow
		if err := rows.Scan(&i.ID, &i.UserID, &i.CategoryID, &i.Period, &i.StartDate, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.CategoryName); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getBudgetByID = `-- name: GetBudgetByID :one
SELECT b.id, b.user_id, b.category_id, b.period, b.start_date, b.created_at, b.updated_at, b.deleted_at, c.name AS category_name
FROM budgets b
JOIN categories c ON c.id = b.category_id
WHERE b.id = $1
  AND b.deleted_at IS NULL
LIMIT 1
`

type GetBudgetByIDRow struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	CategoryID   uuid.UUID
	Period       string
	StartDate    time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
	CategoryName string
}

// GetBudgetByID is deliberately NOT scoped by user_id, same precedent as
// GetWalletByID/GetCategoryByID — the service layer decides 403 vs. 404.
func (q *Queries) GetBudgetByID(ctx context.Context, id uuid.UUID) (GetBudgetByIDRow, error) {
	row := q.db.QueryRow(ctx, getBudgetByID, id)
	var i GetBudgetByIDRow
	err := row.Scan(&i.ID, &i.UserID, &i.CategoryID, &i.Period, &i.StartDate, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.CategoryName)
	return i, err
}

const existsActiveBudgetForCategory = `-- name: ExistsActiveBudgetForCategory :one
SELECT EXISTS (
    SELECT 1 FROM budgets
    WHERE category_id = $1
      AND deleted_at IS NULL
) AS "exists"
`

func (q *Queries) ExistsActiveBudgetForCategory(ctx context.Context, categoryID uuid.UUID) (bool, error) {
	row := q.db.QueryRow(ctx, existsActiveBudgetForCategory, categoryID)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

const touchBudgetUpdatedAt = `-- name: TouchBudgetUpdatedAt :exec
UPDATE budgets
SET updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
`

type TouchBudgetUpdatedAtParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
}

func (q *Queries) TouchBudgetUpdatedAt(ctx context.Context, arg TouchBudgetUpdatedAtParams) error {
	_, err := q.db.Exec(ctx, touchBudgetUpdatedAt, arg.ID, arg.UserID)
	return err
}

const softDeleteBudget = `-- name: SoftDeleteBudget :one
UPDATE budgets
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, category_id, period, start_date, created_at, updated_at, deleted_at
`

type SoftDeleteBudgetParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
}

func (q *Queries) SoftDeleteBudget(ctx context.Context, arg SoftDeleteBudgetParams) (Budget, error) {
	row := q.db.QueryRow(ctx, softDeleteBudget, arg.ID, arg.UserID)
	var i Budget
	err := row.Scan(&i.ID, &i.UserID, &i.CategoryID, &i.Period, &i.StartDate, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt)
	return i, err
}
