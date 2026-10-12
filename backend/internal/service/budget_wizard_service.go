package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/service/budgetproposal"
)

// BudgetWizardService owns F-13 AI Budget Setup Wizard's three
// wizard-adjacent endpoints (specs/ai-budget-wizard/plan.md Finding #3):
// Prefill (a pure read, no AI Service call), Proposals (ownership
// re-validation + budgetproposal.Compute — still no AI Service call, Finding
// #6), and SuggestCategoryName (the one endpoint that is actually
// AI-Service-backed). The bulk-create write itself lives on BudgetService,
// not here — this service never writes budgets/budget_limits/categories.
type BudgetWizardService struct {
	budgetRepo   BudgetRepo
	categoryRepo CategoryRepo
	walletRepo   WalletRepo
	aiClient     AIBudgetClient
	logger       *zap.Logger
}

func NewBudgetWizardService(budgetRepo BudgetRepo, categoryRepo CategoryRepo, walletRepo WalletRepo, aiClient AIBudgetClient, logger *zap.Logger) *BudgetWizardService {
	return &BudgetWizardService{budgetRepo: budgetRepo, categoryRepo: categoryRepo, walletRepo: walletRepo, aiClient: aiClient, logger: logger}
}

// Prefill implements US-01 Main Flow step 3 — never calls the AI Service or
// writes chat_messages (spec.md US-01 Edge Cases #1/#2). Existing Budgets'
// limits are reported as-stored (AmountLimit only); no spend computation is
// necessary at this step, only the caller's current setup at a glance.
func (s *BudgetWizardService) Prefill(ctx context.Context, userID uuid.UUID) (*dto.BudgetWizardPrefillResponse, error) {
	wallets, err := s.walletRepo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.Prefill: %w", err)
	}
	currency := common.WalletDefaultCurrency
	if len(wallets) > 0 {
		currency = wallets[0].Currency
		for _, w := range wallets {
			if w.IsDefault {
				currency = w.Currency
				break
			}
		}
	}

	categories, err := s.categoryRepo.ListCategoriesForUser(ctx, userID, nil)
	if err != nil {
		return nil, fmt.Errorf("service.Prefill: %w", err)
	}

	budgets, err := s.budgetRepo.ListBudgetsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.Prefill: %w", err)
	}
	for _, b := range budgets {
		zeroSpendStatus(b)
	}

	resp := dto.NewBudgetWizardPrefillResponse(currency, categories, budgets)
	return &resp, nil
}

// zeroSpendStatus fills every currency entry's Spent/Remaining/Status with
// its zero-spend values — Prefill only needs to show the caller's currently
// configured limit, not a real spend computation (which BudgetService.List/
// GetBudget already own for F-05's own endpoints).
func zeroSpendStatus(b *model.Budget) {
	b.OverallStatus = model.BudgetStatusWithin
	for i := range b.Limits {
		b.Limits[i].Spent = 0
		b.Limits[i].Remaining = b.Limits[i].AmountLimit
		b.Limits[i].Status = model.BudgetStatusWithin
	}
}

// Proposals runs the v2 allocation (specs/ai-budget-wizard-v2/spec.md US-01 /
// US-07).
//
// Every category id is re-validated against the caller first, gating on the
// first failure, then the whole allocation happens in-process through
// budgetproposal.Compute. There is no AI Service call on this path and there
// never should be: the calculation is arithmetic, and arithmetic done in Go is
// free, instant, reproducible, and unaffected by the AI service being down —
// none of which is true of an LLM, which additionally cannot be trusted to add
// up.
func (s *BudgetWizardService) Proposals(ctx context.Context, userID uuid.UUID, req dto.BudgetProposalsRequest) (*dto.BudgetProposalsResponse, error) {
	intents := make([]budgetproposal.CategoryIntent, 0, len(req.Intents))
	for _, in := range req.Intents {
		category, err := s.categoryRepo.GetCategoryByID(ctx, in.CategoryID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, common.ErrCategoryAccessDenied
			}
			return nil, fmt.Errorf("service.Proposals: %w", err)
		}
		if category.DeletedAt != nil {
			return nil, common.ErrCategoryAccessDenied
		}
		if !category.IsSystem() && *category.UserID != userID {
			return nil, common.ErrCategoryAccessDenied
		}

		// The category's key is read from the row we just fetched, never from
		// the request. The client supplies one for convenience, but trusting it
		// would let a caller claim any category is any preset line.
		systemKey := ""
		if category.SystemKey != nil {
			systemKey = *category.SystemKey
		}

		intents = append(intents, budgetproposal.CategoryIntent{
			CategoryID:   in.CategoryID.String(),
			CategoryName: category.Name,
			SystemKey:    systemKey,
			Source:       budgetproposal.IntentSource(in.Source),
			AmountMin:    in.AmountMin,
			AmountMax:    in.AmountMax,
			Locked:       in.Locked,
		})
	}

	result, err := budgetproposal.Compute(budgetproposal.PlanInput{
		Income:        req.Income,
		FixedTotal:    req.FixedTotal,
		SavingsTarget: req.SavingsTarget,
		Preset:        common.BudgetPresetKey(req.ProfilePreset),
		Intents:       intents,
	})
	if err != nil {
		switch {
		case errors.Is(err, budgetproposal.ErrDisposableNonPositive):
			return nil, common.ErrDisposableNonPositive
		case errors.Is(err, budgetproposal.ErrDisposableTooSmall):
			return nil, common.ErrDisposableTooSmall
		case errors.Is(err, budgetproposal.ErrNoIntents):
			return nil, common.NewInvalidInputError("Chọn ít nhất một danh mục.")
		default:
			return nil, fmt.Errorf("service.Proposals: %w", err)
		}
	}

	proposals := make([]dto.ProposalEntry, 0, len(result.Entries))
	for _, e := range result.Entries {
		categoryID, parseErr := uuid.Parse(e.CategoryID)
		if parseErr != nil {
			return nil, fmt.Errorf("service.Proposals: parsing computed category id: %w", parseErr)
		}
		proposals = append(proposals, dto.ProposalEntry{
			CategoryID:   categoryID,
			CategoryName: e.CategoryName,
			SystemKey:    e.SystemKey,
			AmountMin:    e.AmountMin,
			AmountMax:    e.AmountMax,
			Source:       string(e.Source),
			Locked:       e.Locked,
			Confidence:   e.Confidence,
			Evidence:     e.Evidence,
		})
	}

	return &dto.BudgetProposalsResponse{
		Disposable:        result.Disposable,
		Proposals:         proposals,
		UnallocatedAmount: result.UnallocatedAmount,
		OverCommitted:     result.OverCommitted,
		Shortfall:         result.Shortfall,
		ScaledDown:        result.ScaledDown,
	}, nil
}

// NOTE — v1's defaultSavingsEntry and isSavingsCategoryName were deleted here,
// not moved.
//
// v1 injected a "Tiết kiệm" BUDGET row into every proposal, funded from the
// leftover pool. v2 subtracts savings before disposable is computed
// (spec.md US-05): money set aside is not money available to spend, and listing
// it beside the spending categories makes it look like just another line — the
// one users raid first when something else runs over. It now appears on the
// result screen as an already-deducted reference figure, outside the donut.

// SuggestCategoryName implements US-03's Step 2B / US-05's internal-helper
// subsection — the one AI-Service-backed call this feature makes. Ownership
// re-validation does not apply here: there is no ID in the request, only
// free text (spec.md Security & Actor Resolution: "returns free text ...
// with no ID of any kind to re-validate").
func (s *BudgetWizardService) SuggestCategoryName(ctx context.Context, req dto.SuggestCategoryNameRequest) (*dto.SuggestCategoryNameResponse, error) {
	resp, err := s.aiClient.SuggestCategoryName(ctx, req.Description)
	if err != nil {
		s.logger.Warn("ai service unavailable (suggest-category-name)", zap.Error(err))
		return nil, common.ErrAIServiceUnavailable
	}
	return &dto.SuggestCategoryNameResponse{
		SuggestedName: resp.SuggestedName,
		Type:          resp.Type,
		Icon:          resp.Icon,
	}, nil
}
