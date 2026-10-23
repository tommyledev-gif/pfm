package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

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
