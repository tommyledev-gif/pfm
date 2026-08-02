package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func newTestBudgetService(t *testing.T) (*BudgetService, *fakeBudgetRepo) {
	t.Helper()
	repo := newFakeBudgetRepo()
	return NewBudgetService(repo, zap.NewNop()), repo
}

func seedExpenseCategory(repo *fakeBudgetRepo, ownerID uuid.UUID) *model.Category {
	c := &model.Category{ID: uuid.New(), UserID: &ownerID, Name: "Food", Type: model.CategoryTypeExpense}
	repo.seedCategory(c)
	return c
}

// S-BUD-01/S-BUD-02: happy path create, single and multi-currency.
func TestBudgetService_CreateBudget_Success(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000, "USD": 50000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(budget.Limits) != 2 {
		t.Fatalf("expected 2 currency entries, got %d", len(budget.Limits))
	}
	if budget.CategoryName != category.Name {
		t.Fatalf("expected category name to be attached, got %q", budget.CategoryName)
	}
}

// S-BUD-03: a Budget can only target an expense-type category.
func TestBudgetService_CreateBudget_WrongCategoryType(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	income := &model.Category{ID: uuid.New(), UserID: &userID, Name: "Salary", Type: model.CategoryTypeIncome}
	repo.seedCategory(income)

	_, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: income.ID,
		Limits:     map[string]int64{"VND": 2000000},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidCategoryType {
		t.Fatalf("expected INVALID_CATEGORY_TYPE, got %v", err)
	}
}

// S-BUD-09: referencing a category that does not exist is a 404.
func TestBudgetService_CreateBudget_CategoryNotFound(t *testing.T) {
	svc, _ := newTestBudgetService(t)
	userID := uuid.New()

	_, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: uuid.New(),
		Limits:     map[string]int64{"VND": 2000000},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryNotFound {
		t.Fatalf("expected CATEGORY_NOT_FOUND, got %v", err)
	}
}

// S-BUD-10: a private category owned by someone else is a 403, not a 404.
func TestBudgetService_CreateBudget_CategoryAccessDenied(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	ownerID := uuid.New()
	callerID := uuid.New()
	category := seedExpenseCategory(repo, ownerID)

	_, err := svc.CreateBudget(context.Background(), callerID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
		t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
	}
}

// S-BUD-11: a second active Budget for the same category is rejected — the
// caller must PATCH the existing one instead.
func TestBudgetService_CreateBudget_DuplicateActiveBudget(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	_, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000},
	})
	if err != nil {
		t.Fatalf("unexpected error creating first budget: %v", err)
	}

	_, err = svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"USD": 50000},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeBudgetAlreadyExists {
		t.Fatalf("expected BUDGET_ALREADY_EXISTS, got %v", err)
	}
}

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

// S-BUD-27/S-BUD-28/S-BUD-29: PATCH replaces the entire limits set — adding
// a new currency and dropping a previously-set one both take effect.
func TestBudgetService_UpdateBudget_FullReplace(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 1000000, "USD": 50000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	updated, err := svc.UpdateBudget(context.Background(), userID, budget.ID, dto.UpdateBudgetRequest{
		Limits: map[string]int64{"VND": 1500000},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(updated.Limits) != 1 || updated.Limits[0].Currency != "VND" || updated.Limits[0].AmountLimit != 1500000 {
		t.Fatalf("expected full-replace to leave exactly one VND=1500000 entry, got %+v", updated.Limits)
	}
}

// S-BUD-36: a PATCH body with no limits key at all is a client mistake, not
// a no-op success.
func TestBudgetService_UpdateBudget_EmptyBodyRejected(t *testing.T) {
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

	_, err = svc.UpdateBudget(context.Background(), userID, budget.ID, dto.UpdateBudgetRequest{})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}

// S-BUD-37/S-BUD-39: delete succeeds once, then the same Budget is a 404 on
// a second call — deletion is not idempotent.
func TestBudgetService_DeleteBudget_NotIdempotent(t *testing.T) {
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

	if _, err := svc.DeleteBudget(context.Background(), userID, budget.ID); err != nil {
		t.Fatalf("unexpected error on first delete: %v", err)
	}

	_, err = svc.DeleteBudget(context.Background(), userID, budget.ID)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeBudgetNotFound {
		t.Fatalf("expected BUDGET_NOT_FOUND on second delete, got %v", err)
	}
}
