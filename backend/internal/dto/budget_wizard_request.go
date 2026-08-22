package dto

import (
	"github.com/google/uuid"
)

// BudgetPreference is one selected Category's spending level, submitted by
// the client for POST /ai/budget-proposals (specs/ai-budget-wizard/spec.md
// US-04 Preconditions). CategoryName is echoed back by the client — never
// trusted for identity, only used by budgetproposal.Compute's ai_decides
// baseline-pattern match, since the request never re-fetches the Category
// row just to read its own name back.
type BudgetPreference struct {
	CategoryID         uuid.UUID `json:"category_id" validate:"required"`
	CategoryName       string    `json:"category_name" validate:"required"`
	SpendingPreference string    `json:"spending_preference" validate:"required,oneof=very_little little normal a_lot priority ai_decides"`
}

// BudgetProposalsRequest is the body of POST /ai/budget-proposals
// (specs/ai-budget-wizard/spec.md US-04 Preconditions). Income is guarded
// against overflow in the later weight-multiplication step (S-BWZ-08).
type BudgetProposalsRequest struct {
	Income      int64              `json:"income" validate:"required,gt=0,lte=9999999999"`
	Currency    string             `json:"currency" validate:"required,oneof=VND USD"`
	Period      string             `json:"period" validate:"required,oneof=monthly weekly quarterly"`
	Preferences []BudgetPreference `json:"preferences" validate:"required,min=1,max=20,dive"`
}

// SuggestCategoryNameRequest is the body of POST /ai/suggest-category-name
// (specs/ai-budget-wizard/spec.md US-05 internal-helper subsection).
type SuggestCategoryNameRequest struct {
	Description string `json:"description" validate:"required,max=200"`
}
