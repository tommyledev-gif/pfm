package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// bulkValidatedItem pairs a submitted BulkBudgetItem with the Category name
// its category_id resolved to — carried forward so the created Budget's
// response can denormalize CategoryName without a second read (same
// convention as createBudgetTx's own category.Name attach in
// budget_service.go).
type bulkValidatedItem struct {
	item         dto.BulkBudgetItem
	categoryName string
}

// BulkReplaceBudgets implements F-13 AI Budget Setup Wizard's US-05
// (specs/ai-budget-wizard/spec.md) — one transaction: lock the caller's
// users row (serializes even a first submit with nothing else to lock,
// docs/new-tasks.md I-4) and existing active Budgets, re-validate every
// submitted category (ownership + existence + type=expense,
// sequential/gating per item, plan.md Finding #8),
// delete the locked Budgets' budget_limits rows (batched), soft-delete the
// locked Budgets, then insert the submitted set. All-or-nothing: any failure
// rolls back the whole request via the existing defer tx.Rollback
// convention, so a partially-replaced Budget set is never observed
// (plan.md Business Rules). Split into its own file, alongside
// budget_service.go's own CRUD, per plan.md's explicit file-size concern.
func (s *BudgetService) BulkReplaceBudgets(ctx context.Context, userID uuid.UUID, items []dto.BulkBudgetItem) ([]*model.Budget, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if err := s.repo.LockUserForBudgetReplace(ctx, tx, userID); err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}
	existing, err := s.repo.LockBudgetsByUser(ctx, tx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}

	validated, err := s.validateBulkItems(ctx, tx, userID, items)
	if err != nil {
		return nil, err
	}

	if err := s.repo.DeleteBudgetLimitsByBudgetIDs(ctx, tx, budgetIDsFrom(existing)); err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}
	if err := s.repo.SoftDeleteBudgetsByUser(ctx, tx, userID); err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}

	created, err := s.insertBulkBudgets(ctx, tx, userID, validated)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
	}

	// Freshly (re)created Budgets always report spent=0, same convention as
	// CreateBudget (spec.md US-01 step 6 precedent, applied here to every
	// item in the batch).
	for _, budget := range created {
		s.computeStatus(budget, nil)
	}
	return created, nil
}

// validateBulkItems re-validates every submitted category_id's visibility +
// existence + type=expense, sequential/gating on the first failure
// (spec.md S-BWZ-22/S-BWZ-24, plan.md Finding #8/#2) — inside the caller's
// transaction, before any delete/insert.
func (s *BudgetService) validateBulkItems(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []dto.BulkBudgetItem) ([]bulkValidatedItem, error) {
	validated := make([]bulkValidatedItem, 0, len(items))
	for _, item := range items {
		category, err := s.repo.LockCategoryForBudgetCheck(ctx, tx, item.CategoryID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, common.ErrCategoryNotFound
			}
			return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
		}
		if category.DeletedAt != nil {
			return nil, common.ErrCategoryNotFound
		}
		if !category.IsSystem() && *category.UserID != userID {
			return nil, common.ErrCategoryAccessDenied
		}
		if category.Type != model.CategoryTypeExpense {
			return nil, common.ErrInvalidCategoryType
		}
		validated = append(validated, bulkValidatedItem{item: item, categoryName: category.Name})
	}
	return validated, nil
}

// insertBulkBudgets creates the submitted set, each with the server's own
// current date as start_date (spec.md US-05 Edge Cases #6) — no client-
// supplied start_date exists on dto.BulkBudgetItem to begin with.
func (s *BudgetService) insertBulkBudgets(ctx context.Context, tx pgx.Tx, userID uuid.UUID, validated []bulkValidatedItem) ([]*model.Budget, error) {
	startDate := time.Now().UTC()
	created := make([]*model.Budget, 0, len(validated))
	for _, v := range validated {
		limits := make([]model.BudgetLimit, 0, len(v.item.Limits))
		for _, l := range v.item.Limits {
			limits = append(limits, model.BudgetLimit{Currency: l.Currency, AmountLimit: l.AmountLimit})
		}
		budget, err := s.repo.CreateBudget(ctx, tx, repository.CreateBudgetParams{
			UserID:     userID,
			CategoryID: v.item.CategoryID,
			Period:     v.item.Period,
			StartDate:  startDate,
			Limits:     limits,
		})
		if err != nil {
			return nil, fmt.Errorf("service.BulkReplaceBudgets: %w", err)
		}
		budget.CategoryName = v.categoryName
		created = append(created, budget)
	}
	return created, nil
}

func budgetIDsFrom(budgets []*model.Budget) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(budgets))
	for _, b := range budgets {
		ids = append(ids, b.ID)
	}
	return ids
}
