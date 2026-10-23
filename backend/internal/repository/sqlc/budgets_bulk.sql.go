package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const lockUserForBudgetReplace = `-- name: LockUserForBudgetReplace :exec
SELECT id FROM users
WHERE id = $1
FOR UPDATE
`

// LockUserForBudgetReplace serializes concurrent bulk-replaces for one User,
// including a first-time User with no Budgets to lock (docs/new-tasks.md I-4).
func (q *Queries) LockUserForBudgetReplace(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, lockUserForBudgetReplace, id)
	return err
}

const lockBudgetsByUser = `-- name: LockBudgetsByUser :many
SELECT id, user_id, category_id, period, start_date, created_at, updated_at, deleted_at, icon, icon_url FROM budgets
WHERE user_id = $1
  AND deleted_at IS NULL
FOR UPDATE
`

// LockBudgetsByUser backs F-13 AI Budget Wizard's bulk-replace race guard
// (specs/ai-budget-wizard/spec.md S-BWZ-27, plan.md Finding #5).
func (q *Queries) LockBudgetsByUser(ctx context.Context, userID uuid.UUID) ([]Budget, error) {
	rows, err := q.db.Query(ctx, lockBudgetsByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Budget
	for rows.Next() {
		var i Budget
		if err := rows.Scan(&i.ID, &i.UserID, &i.CategoryID, &i.Period, &i.StartDate, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.Icon, &i.IconURL); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const softDeleteBudgetsByUser = `-- name: SoftDeleteBudgetsByUser :exec
UPDATE budgets
SET deleted_at = NOW()
WHERE user_id = $1
  AND deleted_at IS NULL
`

// SoftDeleteBudgetsByUser replaces every one of the caller's active Budgets
// in one statement (specs/ai-budget-wizard/plan.md Finding #5).
func (q *Queries) SoftDeleteBudgetsByUser(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, softDeleteBudgetsByUser, userID)
	return err
}

const deleteBudgetLimitsByBudgetIDs = `-- name: DeleteBudgetLimitsByBudgetIDs :exec
DELETE FROM budget_limits WHERE budget_id = ANY($1::uuid[])
`

// DeleteBudgetLimitsByBudgetIDs is the batched budget_limits cleanup backing
// the bulk-replace endpoint (specs/ai-budget-wizard/plan.md Finding #10).
func (q *Queries) DeleteBudgetLimitsByBudgetIDs(ctx context.Context, budgetIDs []uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteBudgetLimitsByBudgetIDs, budgetIDs)
	return err
}
