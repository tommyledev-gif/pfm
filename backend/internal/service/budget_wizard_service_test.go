package service

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"

	"github.com/google/uuid"
)

func newTestBudgetWizardService(t *testing.T) (*BudgetWizardService, *fakeCategoryRepo) {
	t.Helper()
	categoryRepo := newFakeCategoryRepo()
	return NewBudgetWizardService(nil, categoryRepo, nil, nil, zap.NewNop()), categoryRepo
}

// seedKeyedCategory seeds a system category carrying a system_key, which is how
// the wizard's presets find it.
func seedKeyedCategory(repo *fakeCategoryRepo, name, systemKey string) uuid.UUID {
	c := repo.seedSystemCategory(name, "expense")
	key := systemKey
	c.SystemKey = &key
	return c.ID
}

func presetRequest(intents []dto.CategoryIntentRequest) dto.BudgetProposalsRequest {
	return dto.BudgetProposalsRequest{
		Income:        12_000_000_00, // 12tr đồng, in xu
		FixedTotal:    2_500_000_00,
		SavingsTarget: 1_200_000_00,
		Currency:      "VND",
		Period:        "monthly",
		CycleStartDay: 1,
		ProfilePreset: string(common.BudgetPresetRentedEatingOut),
		Intents:       intents,
	}
}

// The happy path: a preset fills in every amount, the band is populated, and the
// buffer absorbs the remainder exactly.
func TestBudgetWizardService_Proposals_PresetFillsAmounts(t *testing.T) {
	svc, repo := newTestBudgetWizardService(t)

	shares, _ := common.PresetByKey(common.BudgetPresetRentedEatingOut)
	intents := make([]dto.CategoryIntentRequest, 0, len(shares))
	for _, s := range shares {
		id := seedKeyedCategory(repo, s.SystemKey, s.SystemKey)
		intents = append(intents, dto.CategoryIntentRequest{
			CategoryID:   id,
			CategoryName: s.SystemKey,
			Source:       "preset",
		})
	}

	resp, err := svc.Proposals(context.Background(), uuid.New(), presetRequest(intents))
	if err != nil {
		t.Fatalf("Proposals() error = %v", err)
	}
	if len(resp.Proposals) != len(shares) {
		t.Fatalf("got %d proposals, want %d", len(resp.Proposals), len(shares))
	}

	var allocated int64
	for _, p := range resp.Proposals {
		if p.AmountMax <= 0 {
			t.Errorf("%s got a non-positive amount %d — a preset intent arrives with 0 and the engine must fill it", p.SystemKey, p.AmountMax)
		}
		if p.AmountMin > p.AmountMax {
			t.Errorf("%s band inverted: %d..%d", p.SystemKey, p.AmountMin, p.AmountMax)
		}
		if p.Source != "preset" {
			t.Errorf("%s source = %q, want preset", p.SystemKey, p.Source)
		}
		allocated += p.AmountMax
	}
	if allocated+resp.UnallocatedAmount != resp.Disposable {
		t.Errorf("allocated(%d) + buffer(%d) != disposable(%d)", allocated, resp.UnallocatedAmount, resp.Disposable)
	}
}

// ⚠️ The category's key is read from the database row, never from the request.
// A client that could assert its own system_key could claim any category is any
// preset line, and the preset's share would follow.
func TestBudgetWizardService_Proposals_IgnoresClientSuppliedSystemKey(t *testing.T) {
	svc, repo := newTestBudgetWizardService(t)

	foodID := seedKeyedCategory(repo, "Ăn uống", "food")
	otherID := seedKeyedCategory(repo, "Chi khác", "other")

	resp, err := svc.Proposals(context.Background(), uuid.New(), presetRequest([]dto.CategoryIntentRequest{
		{CategoryID: foodID, CategoryName: "Ăn uống", SystemKey: "other", Source: "preset"},
		// Claims to be food (40% of disposable) while actually being `other` (8%).
		{CategoryID: otherID, CategoryName: "Chi khác", SystemKey: "food", Source: "preset"},
	}))
	if err != nil {
		t.Fatalf("Proposals() error = %v", err)
	}

	byID := map[uuid.UUID]dto.ProposalEntry{}
	for _, p := range resp.Proposals {
		byID[p.CategoryID] = p
	}
	if byID[foodID].AmountMax <= byID[otherID].AmountMax {
		t.Errorf("the request's system_key was honoured: food=%d other=%d — food carries a 40%% share and other 8%%, so food must be larger",
			byID[foodID].AmountMax, byID[otherID].AmountMax)
	}
}

// Ownership re-validation: another user's category is refused before any
// arithmetic runs.
func TestBudgetWizardService_Proposals_RejectsForeignCategory(t *testing.T) {
	svc, repo := newTestBudgetWizardService(t)

	owner := uuid.New()
	foreign := repo.seedSystemCategory("Ăn uống", "expense")
	stranger := uuid.New()
	foreign.UserID = &stranger

	_, err := svc.Proposals(context.Background(), owner, presetRequest([]dto.CategoryIntentRequest{
		{CategoryID: foreign.ID, CategoryName: foreign.Name, Source: "preset"},
	}))
	if !errors.Is(err, common.ErrCategoryAccessDenied) {
		t.Fatalf("got %v, want ErrCategoryAccessDenied", err)
	}
}

// Fixed costs plus savings swallowing the whole income gets its own error code,
// not a generic INVALID_INPUT — the client has a specific screen and message for
// it, and the user can act on it.
func TestBudgetWizardService_Proposals_DisposableNonPositive(t *testing.T) {
	svc, repo := newTestBudgetWizardService(t)
	id := seedKeyedCategory(repo, "Ăn uống", "food")

	req := presetRequest([]dto.CategoryIntentRequest{{CategoryID: id, CategoryName: "Ăn uống", Source: "preset"}})
	req.FixedTotal = req.Income
	req.SavingsTarget = 1

	_, err := svc.Proposals(context.Background(), uuid.New(), req)
	if !errors.Is(err, common.ErrDisposableNonPositive) {
		t.Fatalf("got %v, want ErrDisposableNonPositive", err)
	}
}
