package dto

import (
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// BudgetWizardPrefillResponse is the body of GET /ai/budget-wizard/prefill
// (specs/ai-budget-wizard/spec.md US-01 Main Flow step 3) — a pure read, no
// AI Service call, no chat_messages write.
type BudgetWizardPrefillResponse struct {
	Currency        string             `json:"currency"`
	Categories      []CategoryResponse `json:"categories"`
	ExistingBudgets []BudgetResponse   `json:"existing_budgets"`
}

func NewBudgetWizardPrefillResponse(currency string, categories []*model.Category, existingBudgets []*model.Budget) BudgetWizardPrefillResponse {
	return BudgetWizardPrefillResponse{
		Currency:        currency,
		Categories:      NewListCategoriesResponse(categories).Data,
		ExistingBudgets: NewListBudgetsResponse(existingBudgets).Data,
	}
}

// ProposalEntry is one Category's computed proposal, per
// specs/ai-budget-wizard/spec.md US-04 Main Flow step 4 — Reasoning is a
// one-line, rule-based (never LLM-generated) explanation of how the amount
// was derived.
type ProposalEntry struct {
	CategoryID      uuid.UUID `json:"category_id"`
	CategoryName    string    `json:"category_name"`
	ProposedAmount  int64     `json:"proposed_amount"`
	PercentOfIncome float64   `json:"percent_of_income"`
	Reasoning       string    `json:"reasoning"`
}

// BudgetProposalsResponse is the body of POST /ai/budget-proposals's 200
// response — Unallocated is always ≥10% of income (spec.md US-04 Main Flow
// step 3 / S-BWZ-19), never silently distributed.
type BudgetProposalsResponse struct {
	Proposals          []ProposalEntry `json:"proposals"`
	UnallocatedAmount  int64           `json:"unallocated_amount"`
	UnallocatedPercent float64         `json:"unallocated_percent"`
	ScaledDownNotice   bool            `json:"scaled_down_notice"`
}

// SuggestCategoryNameResponse is the body of POST /ai/suggest-category-name's
// 200 response (specs/ai-budget-wizard/spec.md US-05 internal-helper
// subsection) — an LLM call, the one deliberate exception to this feature's
// "rule-based, not LLM" design.
type SuggestCategoryNameResponse struct {
	SuggestedName string `json:"suggested_name"`
	Type          string `json:"type"`
	Icon          string `json:"icon"`
}
