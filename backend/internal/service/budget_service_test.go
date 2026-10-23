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

// S-BWZ-20/S-BWZ-21: BulkReplaceBudgets fully replaces the caller's active
// Budget set — an untouched existing Budget ("Shopping") is soft-deleted,
// not merged with the new set (specs/ai-budget-wizard/spec.md US-05).
func TestBudgetService_BulkReplaceBudgets_FullReplace(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	shopping := seedExpenseCategory(repo, userID)
	if _, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: shopping.ID, Limits: map[string]int64{"VND": 500000},
	}); err != nil {
		t.Fatalf("unexpected error seeding existing budget: %v", err)
	}

	food := seedExpenseCategory(repo, userID)
	created, err := svc.BulkReplaceBudgets(context.Background(), userID, []dto.BulkBudgetItem{
		{CategoryID: food.ID, Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 2000000}}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(created) != 1 || created[0].CategoryID != food.ID {
		t.Fatalf("expected exactly the new Food budget to be created, got %+v", created)
	}

	remaining, err := svc.ListBudgets(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(remaining) != 1 || remaining[0].CategoryID != food.ID {
		t.Fatalf("expected the old Shopping budget to be replaced away, got %+v", remaining)
	}
}

// S-BWZ-22: a category_id that no longer exists aborts the whole request —
// nothing is created, mirroring CreateBudget's own not-found handling.
func TestBudgetService_BulkReplaceBudgets_CategoryNotFound(t *testing.T) {
	svc, _ := newTestBudgetService(t)
	userID := uuid.New()

	_, err := svc.BulkReplaceBudgets(context.Background(), userID, []dto.BulkBudgetItem{
		{CategoryID: uuid.New(), Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 1000000}}},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryNotFound {
		t.Fatalf("expected CATEGORY_NOT_FOUND, got %v", err)
	}
}

// S-BWZ-24: a category_id belonging to a different user is a 403, not a 404.
func TestBudgetService_BulkReplaceBudgets_CategoryAccessDenied(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	ownerID := uuid.New()
	callerID := uuid.New()
	category := seedExpenseCategory(repo, ownerID)

	_, err := svc.BulkReplaceBudgets(context.Background(), callerID, []dto.BulkBudgetItem{
		{CategoryID: category.ID, Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 1000000}}},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
		t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
	}
}

// plan.md Finding #2: an income-type Category is a hard 422
// INVALID_CATEGORY_TYPE on the bulk endpoint too, same as single Create —
// spec.md's "non-blocking warning" is client-side-only, not a server-side
// loosening of this invariant.
func TestBudgetService_BulkReplaceBudgets_WrongCategoryType(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	income := &model.Category{ID: uuid.New(), UserID: &userID, Name: "Salary", Type: model.CategoryTypeIncome}
	repo.seedCategory(income)

	_, err := svc.BulkReplaceBudgets(context.Background(), userID, []dto.BulkBudgetItem{
		{CategoryID: income.ID, Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 1000000}}},
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidCategoryType {
		t.Fatalf("expected INVALID_CATEGORY_TYPE, got %v", err)
	}
}

// spec.md US-05 Edge Cases #6: every bulk-created Budget gets a
// server-assigned start_date, never a client-supplied one (BulkBudgetItem
// has no such field to begin with — this asserts the service still produces
// a sane, non-zero StartDate).
func TestBudgetService_BulkReplaceBudgets_ServerAssignedStartDate(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	created, err := svc.BulkReplaceBudgets(context.Background(), userID, []dto.BulkBudgetItem{
		{CategoryID: category.ID, Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 1000000}}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created[0].StartDate.IsZero() {
		t.Fatalf("expected a server-assigned non-zero start_date")
	}
}

func newTestBudgetService(t *testing.T) (*BudgetService, *fakeBudgetRepo) {
	t.Helper()
	repo := newFakeBudgetRepo()
	return NewBudgetService(repo, newTestCycleResolver(), zap.NewNop()), repo
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
