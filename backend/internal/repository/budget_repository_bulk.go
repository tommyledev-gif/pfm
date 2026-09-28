package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
)

// LockUserForBudgetReplace locks the caller's users row inside tx, so two
// concurrent bulk-replaces serialize even when there are no Budgets for
// LockBudgetsByUser to lock (docs/new-tasks.md I-4). Must be the first
// statement of the replace transaction.
func (r *BudgetRepository) LockUserForBudgetReplace(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	if err := r.q.WithTx(tx).LockUserForBudgetReplace(ctx, userID); err != nil {
		return fmt.Errorf("repository.LockUserForBudgetReplace: %w", err)
	}
	return nil
}

// LockBudgetsByUser takes a row lock on every one of userID's non-deleted
// Budgets, inside the caller's transaction — closes the bulk-replace race
// between two concurrent wizard submissions
// (specs/ai-budget-wizard/spec.md S-BWZ-27, plan.md Finding #5). Returns an
// empty slice (not an error) when the caller has no active Budgets yet. Kept
// in its own file, alongside budget_repository.go's own CRUD, per
// plan.md's explicit file-size concern.
func (r *BudgetRepository) LockBudgetsByUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) ([]*model.Budget, error) {
	rows, err := r.q.WithTx(tx).LockBudgetsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.LockBudgetsByUser: %w", err)
	}
	budgets := make([]*model.Budget, 0, len(rows))
	for _, row := range rows {
		budgets = append(budgets, &model.Budget{
			ID:         row.ID,
			UserID:     row.UserID,
			CategoryID: row.CategoryID,
			Period:     row.Period,
			StartDate:  row.StartDate,
			Icon:       row.Icon,
			IconURL:    row.IconURL,
			CreatedAt:  row.CreatedAt,
			UpdatedAt:  row.UpdatedAt,
			DeletedAt:  row.DeletedAt,
		})
	}
	return budgets, nil
}

// SoftDeleteBudgetsByUser replaces every one of userID's active Budgets in
// one statement — the bulk-replace endpoint's "full replace, not a merge"
// semantics (specs/ai-budget-wizard/spec.md Edge Cases #1). Must be called
// after LockBudgetsByUser inside the same transaction.
func (r *BudgetRepository) SoftDeleteBudgetsByUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	if err := r.q.WithTx(tx).SoftDeleteBudgetsByUser(ctx, userID); err != nil {
		return fmt.Errorf("repository.SoftDeleteBudgetsByUser: %w", err)
	}
	return nil
}

// DeleteBudgetLimitsByBudgetIDs is the batched budget_limits cleanup for the
// bulk-replace endpoint (specs/ai-budget-wizard/plan.md Finding #10) — one
// statement instead of a per-Budget DeleteBudgetLimits loop. A no-op when
// budgetIDs is empty (the caller had nothing to replace).
func (r *BudgetRepository) DeleteBudgetLimitsByBudgetIDs(ctx context.Context, tx pgx.Tx, budgetIDs []uuid.UUID) error {
	if len(budgetIDs) == 0 {
		return nil
	}
	if err := r.q.WithTx(tx).DeleteBudgetLimitsByBudgetIDs(ctx, budgetIDs); err != nil {
		return fmt.Errorf("repository.DeleteBudgetLimitsByBudgetIDs: %w", err)
	}
	return nil
}
