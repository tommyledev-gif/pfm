package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// S-BUD-24 vs S-BUD-25: ownership vs. existence must return distinct codes.
func TestBudgetService_GetBudget_VisibilitySplit(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	ownerID := uuid.New()
	otherID := uuid.New()
	category := seedExpenseCategory(repo, ownerID)

	budget, err := svc.CreateBudget(context.Background(), ownerID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("owner can view it", func(t *testing.T) {
		got, err := svc.GetBudget(context.Background(), ownerID, budget.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.OverallStatus != model.BudgetStatusWithin {
			t.Fatalf("expected overall status 'within' with zero spend, got %q", got.OverallStatus)
		}
	})

	t.Run("another user gets 403 BUDGET_ACCESS_DENIED", func(t *testing.T) {
		_, err := svc.GetBudget(context.Background(), otherID, budget.ID)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeBudgetAccessDenied {
			t.Fatalf("expected BUDGET_ACCESS_DENIED, got %v", err)
		}
	})

	t.Run("a nonexistent id gets 404 BUDGET_NOT_FOUND", func(t *testing.T) {
		_, err := svc.GetBudget(context.Background(), ownerID, uuid.New())
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeBudgetNotFound {
			t.Fatalf("expected BUDGET_NOT_FOUND, got %v", err)
		}
	})
}

// S-BUD-19/S-BUD-20: GetBudget/ListBudgets compute real spent/remaining/status
// from BudgetRepo.SpentByUserCurrentPeriod (specs/transaction-management/
// plan.md Finding #3 / BUD-T17 — closes the Finding #1 stub this used to be).
func TestBudgetService_GetBudget_ComputesRealSpend(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 1000000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("within limit", func(t *testing.T) {
		repo.seedSpend(category.ID, "VND", 600000)
		got, err := svc.GetBudget(context.Background(), userID, budget.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Limits[0].Spent != 600000 || got.Limits[0].Remaining != 400000 || got.OverallStatus != model.BudgetStatusWithin {
			t.Fatalf("expected spent=600000/remaining=400000/within, got %+v", got.Limits[0])
		}
	})

	t.Run("exceeded", func(t *testing.T) {
		repo.seedSpend(category.ID, "VND", 1200000)
		got, err := svc.GetBudget(context.Background(), userID, budget.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Limits[0].Spent != 1200000 || got.Limits[0].Remaining != -200000 || got.OverallStatus != model.BudgetStatusExceeded {
			t.Fatalf("expected spent=1200000/remaining=-200000/exceeded, got %+v", got.Limits[0])
		}
	})
}

// S-BUD-19 (Create half): a freshly created Budget always reports spent=0
// regardless of any pre-existing spend already staged for that category —
// spec.md US-01 step 6's deliberate exception to real spend computation.
func TestBudgetService_CreateBudget_AlwaysReportsZeroSpentRegardlessOfExistingSpend(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)
	repo.seedSpend(category.ID, "VND", 999999999)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 1000000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if budget.Limits[0].Spent != 0 || budget.OverallStatus != model.BudgetStatusWithin {
		t.Fatalf("expected spent=0/within on create regardless of existing spend, got %+v", budget.Limits[0])
	}
}

// S-BUD-15: list scopes strictly to the caller.
func TestBudgetService_ListBudgets_ScopedToCaller(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	callerID := uuid.New()
	otherID := uuid.New()

	callerCategory := seedExpenseCategory(repo, callerID)
	otherCategory := seedExpenseCategory(repo, otherID)

	if _, err := svc.CreateBudget(context.Background(), callerID, dto.CreateBudgetRequest{CategoryID: callerCategory.ID, Limits: map[string]int64{"VND": 1000000}}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.CreateBudget(context.Background(), otherID, dto.CreateBudgetRequest{CategoryID: otherCategory.ID, Limits: map[string]int64{"VND": 1000000}}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	budgets, err := svc.ListBudgets(context.Background(), callerID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(budgets) != 1 {
		t.Fatalf("expected exactly 1 budget for the caller, got %d", len(budgets))
	}
}
