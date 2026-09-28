package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const getActiveCycleStartDay = `-- name: GetActiveCycleStartDay :one
SELECT cycle_start_day FROM budget_plans
WHERE user_id = $1
  AND superseded_at IS NULL
`

// GetActiveCycleStartDay backs service.CycleResolver
// (specs/ai-budget-wizard-v2/spec.md US-03). No row means no plan.
func (q *Queries) GetActiveCycleStartDay(ctx context.Context, userID uuid.UUID) (int16, error) {
	row := q.db.QueryRow(ctx, getActiveCycleStartDay, userID)
	var cycle_start_day int16
	err := row.Scan(&cycle_start_day)
	return cycle_start_day, err
}
