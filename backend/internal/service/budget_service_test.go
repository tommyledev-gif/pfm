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

// S-WBI-19/S-WBI-20 (specs/wallet-budget-icons/spec.md): icon/icon_url are
// fully optional and independent of the Budget's linked Category's own icon.
func TestBudgetService_CreateBudget_WithIconFields(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	withIcon, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000},
		Icon:       strPtr("🍔"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if withIcon.Icon == nil || *withIcon.Icon != "🍔" {
		t.Fatalf("expected icon to be persisted, got %v", withIcon.Icon)
	}

	otherCategory := seedExpenseCategory(repo, userID)
	withNeither, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: otherCategory.ID,
		Limits:     map[string]int64{"USD": 100},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if withNeither.Icon != nil || withNeither.IconURL != nil {
		t.Fatalf("expected both icon fields to remain nil when omitted, got icon=%v icon_url=%v", withNeither.Icon, withNeither.IconURL)
	}
}

// S-WBI-21 / plan.md Finding #1: an omitted icon_url key leaves the existing
// photo untouched, while an explicit `"icon_url": null` clears it.
func TestBudgetService_UpdateBudget_IconURLOmittedVsExplicitNull(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000},
		IconURL:    strPtr("https://cdn.example/b.png"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("limits-only update leaves icon_url untouched", func(t *testing.T) {
		updated, err := svc.UpdateBudget(context.Background(), userID, budget.ID, dto.UpdateBudgetRequest{
			Limits: map[string]int64{"VND": 3000000},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.IconURL == nil || *updated.IconURL != "https://cdn.example/b.png" {
			t.Fatalf("expected icon_url to remain untouched, got %v", updated.IconURL)
		}
	})

	t.Run("explicit null clears the photo without touching limits", func(t *testing.T) {
		req := dto.UpdateBudgetRequest{IconURL: dto.OptionalString{Set: true, Value: nil}}
		updated, err := svc.UpdateBudget(context.Background(), userID, budget.ID, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.IconURL != nil {
			t.Fatalf("expected icon_url to be cleared, got %v", updated.IconURL)
		}
		if len(updated.Limits) != 1 || updated.Limits[0].AmountLimit != 3000000 {
			t.Fatalf("expected the icon-only update to leave limits untouched, got %+v", updated.Limits)
		}
	})
}

// Regression guard for the bug this feature's plan explicitly flagged as a
// risk: an icon-only update (no `limits` key at all) must never wipe a
// Budget's existing budget_limits rows via ReplaceBudgetLimits.
func TestBudgetService_UpdateBudget_IconOnlyDoesNotWipeLimits(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	budget, err := svc.CreateBudget(context.Background(), userID, dto.CreateBudgetRequest{
		CategoryID: category.ID,
		Limits:     map[string]int64{"VND": 2000000, "USD": 500},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	updated, err := svc.UpdateBudget(context.Background(), userID, budget.ID, dto.UpdateBudgetRequest{Icon: strPtr("💸")})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Icon == nil || *updated.Icon != "💸" {
		t.Fatalf("expected icon to be updated, got %v", updated.Icon)
	}
	if len(updated.Limits) != 2 {
		t.Fatalf("expected both pre-existing currency limits to survive an icon-only update, got %+v", updated.Limits)
	}
}
