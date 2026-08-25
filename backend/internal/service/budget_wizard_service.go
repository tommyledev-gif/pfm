package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

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

// Proposals implements US-04's Main Flow — re-validates every category_id is
// visible to the caller (system-defined or owned), sequential/gating on the
// first failure (spec.md S-BWZ-15, plan.md Finding #8), then computes the
// proposal entirely in-process via budgetproposal.Compute (no AI Service
// call at all, plan.md Finding #6).
func (s *BudgetWizardService) Proposals(ctx context.Context, userID uuid.UUID, req dto.BudgetProposalsRequest) (*dto.BudgetProposalsResponse, error) {
	inputs := make([]budgetproposal.Input, 0, len(req.Preferences))
	for _, pref := range req.Preferences {
		category, err := s.categoryRepo.GetCategoryByID(ctx, pref.CategoryID)
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

		inputs = append(inputs, budgetproposal.Input{
			CategoryID:         pref.CategoryID.String(),
			CategoryName:       pref.CategoryName,
			SpendingPreference: pref.SpendingPreference,
		})
	}

	result := budgetproposal.Compute(req.Income, inputs)

	entries := make([]dto.ProposalEntry, 0, len(result.Entries)+1)
	for _, e := range result.Entries {
		categoryID, err := uuid.Parse(e.CategoryID)
		if err != nil {
			return nil, fmt.Errorf("service.Proposals: parsing computed category id: %w", err)
		}
		entries = append(entries, dto.ProposalEntry{
			CategoryID:      categoryID,
			CategoryName:    e.CategoryName,
			ProposedAmount:  e.Amount,
			PercentOfIncome: e.PercentOfIncome,
			Reasoning:       e.Reasoning,
		})
	}

	unallocatedAmount := result.UnallocatedAmount
	unallocatedPercent := result.UnallocatedPercent
	savingsEntry, err := s.defaultSavingsEntry(ctx, userID, req.Income, req.Preferences, unallocatedAmount)
	if err != nil {
		return nil, fmt.Errorf("service.Proposals: %w", err)
	}
	if savingsEntry != nil {
		entries = append(entries, *savingsEntry)
		unallocatedAmount -= savingsEntry.ProposedAmount
		unallocatedPercent = 0
		if req.Income > 0 {
			unallocatedPercent = float64(unallocatedAmount) / float64(req.Income)
		}
	}

	return &dto.BudgetProposalsResponse{
		Proposals:          entries,
		UnallocatedAmount:  unallocatedAmount,
		UnallocatedPercent: unallocatedPercent,
		ScaledDownNotice:   result.ScaledDown,
	}, nil
}

// defaultSavingsEntry implements this feature's "always propose a Savings
// budget" product decision (not spec-derived — see
// common.BudgetWizardDefaultSavingsShare): every wizard run gets a Savings
// line even if the user never thought to select one themselves. Returns nil
// (no entry, request unchanged) when the user already selected a
// savings-named Category — budgetproposal.Compute already priced that one in
// — or when no savings Category is visible to the user (e.g. the
// 017_seed_savings_category.sql seed hasn't run), or when the unallocated
// pool left after Compute can't cover even the minimum per-Category amount.
// Deliberately funds itself out of the unallocated remainder rather than
// displacing the user's own chosen Categories' amounts.
func (s *BudgetWizardService) defaultSavingsEntry(ctx context.Context, userID uuid.UUID, income int64, preferences []dto.BudgetPreference, unallocatedAmount int64) (*dto.ProposalEntry, error) {
	for _, pref := range preferences {
		if isSavingsCategoryName(pref.CategoryName) {
			return nil, nil
		}
	}

	expenseType := string(model.CategoryTypeExpense)
	categories, err := s.categoryRepo.ListCategoriesForUser(ctx, userID, &expenseType)
	if err != nil {
		return nil, fmt.Errorf("defaultSavingsEntry: %w", err)
	}
	var savingsCategory *model.Category
	for _, c := range categories {
		if isSavingsCategoryName(c.Name) {
			savingsCategory = c
			if c.IsSystem() {
				break // prefer the seeded system Category over a same-named user one
			}
		}
	}
	if savingsCategory == nil {
		return nil, nil
	}

	amount := int64(common.BudgetWizardDefaultSavingsShare * float64(income))
	if amount > unallocatedAmount {
		amount = unallocatedAmount
	}
	if amount < common.BudgetWizardMinAmountPerCategory {
		return nil, nil
	}

	return &dto.ProposalEntry{
		CategoryID:      savingsCategory.ID,
		CategoryName:    savingsCategory.Name,
		ProposedAmount:  amount,
		PercentOfIncome: float64(amount) / float64(income),
		Reasoning:       "Mặc định trích một phần thu nhập cho tiết kiệm — bạn có thể chỉnh hoặc xóa ở bước tiếp theo.",
	}, nil
}

// isSavingsCategoryName matches common.BudgetWizardSavingsCategoryNamePatterns
// case-insensitively against a substring of name, same technique as
// budgetproposal.categoryBaseline's keyword matching.
func isSavingsCategoryName(name string) bool {
	lower := strings.ToLower(name)
	for _, pattern := range common.BudgetWizardSavingsCategoryNamePatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

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
