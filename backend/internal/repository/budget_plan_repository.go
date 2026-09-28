package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// BudgetPlanRepository reads the plan layer (020_budget_plans.sql). Today it
// exposes only what the spend window needs; plan versioning writes
// (specs/ai-budget-wizard-v2 US-04) extend this file when they land.
type BudgetPlanRepository struct {
	q *sqlc.Queries
}

func NewBudgetPlanRepository(q *sqlc.Queries) *BudgetPlanRepository {
	return &BudgetPlanRepository{q: q}
}

// ActiveCycleStartDay returns the caller's active plan's cycle_start_day, or
// 0 when they have no active plan — the resolver reads 0 as "calendar month".
func (r *BudgetPlanRepository) ActiveCycleStartDay(ctx context.Context, userID uuid.UUID) (int, error) {
	day, err := r.q.GetActiveCycleStartDay(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("repository.ActiveCycleStartDay: %w", err)
	}
	return int(day), nil
}
