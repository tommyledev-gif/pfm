package service

import (
	"context"
	"testing"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/dto"

	"github.com/google/uuid"
)

func newTestBudgetWizardService(t *testing.T) (*BudgetWizardService, *fakeCategoryRepo) {
	t.Helper()
	categoryRepo := newFakeCategoryRepo()
	return NewBudgetWizardService(nil, categoryRepo, nil, nil, zap.NewNop()), categoryRepo
}

// Proposals must always include a Savings entry by default (product
// decision, not spec-derived) even when the user never selected one
// themselves — see BudgetWizardService.defaultSavingsEntry.
func TestBudgetWizardService_Proposals_InjectsDefaultSavings(t *testing.T) {
	svc, categoryRepo := newTestBudgetWizardService(t)
	food := categoryRepo.seedSystemCategory("Food", "expense")
	savings := categoryRepo.seedSystemCategory("Tiết kiệm", "expense")

	resp, err := svc.Proposals(context.Background(), uuid.New(), dto.BudgetProposalsRequest{
		Income:   10_000_000_00,
		Currency: "VND",
		Period:   "monthly",
		Preferences: []dto.BudgetPreference{
			{CategoryID: food.ID, CategoryName: food.Name, SpendingPreference: "normal"},
		},
	})
	if err != nil {
		t.Fatalf("Proposals() error = %v", err)
	}

	var savingsEntry *dto.ProposalEntry
	for i := range resp.Proposals {
		if resp.Proposals[i].CategoryID == savings.ID {
			savingsEntry = &resp.Proposals[i]
		}
	}
	if savingsEntry == nil {
		t.Fatalf("Proposals() did not inject a Savings entry, got %+v", resp.Proposals)
	}
	if savingsEntry.ProposedAmount <= 0 {
		t.Errorf("savings ProposedAmount = %d, want > 0", savingsEntry.ProposedAmount)
	}
	if resp.UnallocatedAmount < 0 {
		t.Errorf("UnallocatedAmount = %d, want >= 0 after funding savings out of the remainder", resp.UnallocatedAmount)
	}
}

// A user who already selected their own Savings-named Category must not get
// a second, duplicate one injected on top of it.
func TestBudgetWizardService_Proposals_NoDuplicateWhenUserAlreadySelectedSavings(t *testing.T) {
	svc, categoryRepo := newTestBudgetWizardService(t)
	savings := categoryRepo.seedSystemCategory("Tiết kiệm", "expense")

	resp, err := svc.Proposals(context.Background(), uuid.New(), dto.BudgetProposalsRequest{
		Income:   10_000_000_00,
		Currency: "VND",
		Period:   "monthly",
		Preferences: []dto.BudgetPreference{
			{CategoryID: savings.ID, CategoryName: savings.Name, SpendingPreference: "normal"},
		},
	})
	if err != nil {
		t.Fatalf("Proposals() error = %v", err)
	}
	if len(resp.Proposals) != 1 {
		t.Fatalf("Proposals() = %+v, want exactly 1 entry (no auto-injected duplicate)", resp.Proposals)
	}
}

// No system/user Savings Category visible (e.g. seed migration hasn't run)
// must degrade gracefully — no entry injected, no error.
func TestBudgetWizardService_Proposals_NoSavingsCategoryAvailable(t *testing.T) {
	svc, categoryRepo := newTestBudgetWizardService(t)
	food := categoryRepo.seedSystemCategory("Food", "expense")

	resp, err := svc.Proposals(context.Background(), uuid.New(), dto.BudgetProposalsRequest{
		Income:   10_000_000_00,
		Currency: "VND",
		Period:   "monthly",
		Preferences: []dto.BudgetPreference{
			{CategoryID: food.ID, CategoryName: food.Name, SpendingPreference: "normal"},
		},
	})
	if err != nil {
		t.Fatalf("Proposals() error = %v", err)
	}
	if len(resp.Proposals) != 1 {
		t.Fatalf("Proposals() = %+v, want exactly 1 entry (no Savings Category to inject)", resp.Proposals)
	}
}
