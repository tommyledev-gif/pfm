package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const spendingIntentionColumns = `id, user_id, title, kind, category_id, currency, total_amount, monthly_amount, installment_months, target_month, note, idempotency_key, created_at, updated_at, deleted_at`

func scanSpendingIntention(row interface{ Scan(dest ...any) error }) (SpendingIntention, error) {
	var i SpendingIntention
	err := row.Scan(
		&i.ID, &i.UserID, &i.Title, &i.Kind, &i.CategoryID, &i.Currency, &i.TotalAmount, &i.MonthlyAmount,
		&i.InstallmentMonths, &i.TargetMonth, &i.Note, &i.IdempotencyKey, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
	)
	return i, err
}

const createSpendingIntention = `-- name: CreateSpendingIntention :one
INSERT INTO spending_intentions (
    user_id, title, kind, category_id, currency, total_amount, monthly_amount,
    installment_months, target_month, note, idempotency_key
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING ` + spendingIntentionColumns

type CreateSpendingIntentionParams struct {
	UserID            uuid.UUID
	Title             string
	Kind              string
	CategoryID        *uuid.UUID
	Currency          string
	TotalAmount       *int64
	MonthlyAmount     *int64
	InstallmentMonths *int32
	TargetMonth       time.Time
	Note              *string
	IdempotencyKey    *string
}

func (q *Queries) CreateSpendingIntention(ctx context.Context, arg CreateSpendingIntentionParams) (SpendingIntention, error) {
	return scanSpendingIntention(q.db.QueryRow(ctx, createSpendingIntention,
		arg.UserID, arg.Title, arg.Kind, arg.CategoryID, arg.Currency, arg.TotalAmount, arg.MonthlyAmount,
		arg.InstallmentMonths, arg.TargetMonth, arg.Note, arg.IdempotencyKey,
	))
}

const getSpendingIntentionByID = `-- name: GetSpendingIntentionByID :one
SELECT ` + spendingIntentionColumns + ` FROM spending_intentions
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
`

func (q *Queries) GetSpendingIntentionByID(ctx context.Context, id, userID uuid.UUID) (SpendingIntention, error) {
	return scanSpendingIntention(q.db.QueryRow(ctx, getSpendingIntentionByID, id, userID))
}

const getSpendingIntentionByKey = `-- name: GetSpendingIntentionByKey :one
SELECT ` + spendingIntentionColumns + ` FROM spending_intentions
WHERE user_id = $1 AND idempotency_key = $2
`

func (q *Queries) GetSpendingIntentionByKey(ctx context.Context, userID uuid.UUID, key string) (SpendingIntention, error) {
	return scanSpendingIntention(q.db.QueryRow(ctx, getSpendingIntentionByKey, userID, key))
}

const listSpendingIntentionsByUser = `-- name: ListSpendingIntentionsByUser :many
SELECT ` + spendingIntentionColumns + ` FROM spending_intentions
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY target_month ASC, created_at ASC
`

func (q *Queries) ListSpendingIntentionsByUser(ctx context.Context, userID uuid.UUID) ([]SpendingIntention, error) {
	rows, err := q.db.Query(ctx, listSpendingIntentionsByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SpendingIntention
	for rows.Next() {
		i, err := scanSpendingIntention(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const countSpendingIntentionsByUser = `-- name: CountSpendingIntentionsByUser :one
SELECT COUNT(*) FROM spending_intentions
WHERE user_id = $1 AND deleted_at IS NULL
`

func (q *Queries) CountSpendingIntentionsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countSpendingIntentionsByUser, userID).Scan(&n)
	return n, err
}

const updateSpendingIntention = `-- name: UpdateSpendingIntention :one
UPDATE spending_intentions
SET title = $3, kind = $4, category_id = $5, currency = $6, total_amount = $7,
    monthly_amount = $8, installment_months = $9, target_month = $10, note = $11,
    updated_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING ` + spendingIntentionColumns

type UpdateSpendingIntentionParams struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	Title             string
	Kind              string
	CategoryID        *uuid.UUID
	Currency          string
	TotalAmount       *int64
	MonthlyAmount     *int64
	InstallmentMonths *int32
	TargetMonth       time.Time
	Note              *string
}

func (q *Queries) UpdateSpendingIntention(ctx context.Context, arg UpdateSpendingIntentionParams) (SpendingIntention, error) {
	return scanSpendingIntention(q.db.QueryRow(ctx, updateSpendingIntention,
		arg.ID, arg.UserID, arg.Title, arg.Kind, arg.CategoryID, arg.Currency, arg.TotalAmount,
		arg.MonthlyAmount, arg.InstallmentMonths, arg.TargetMonth, arg.Note,
	))
}

const softDeleteSpendingIntention = `-- name: SoftDeleteSpendingIntention :execrows
UPDATE spending_intentions
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
`

func (q *Queries) SoftDeleteSpendingIntention(ctx context.Context, id, userID uuid.UUID) (int64, error) {
	tag, err := q.db.Exec(ctx, softDeleteSpendingIntention, id, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
