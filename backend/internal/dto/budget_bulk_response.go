package dto

import "github.com/example/pfm/backend/internal/model"

// BulkCreateBudgetsResponse is the body of POST /budgets/bulk's 201 response
// (specs/ai-budget-wizard/spec.md US-05 Main Flow step 5).
type BulkCreateBudgetsResponse struct {
	CreatedCount int              `json:"created_count"`
	Budgets      []BudgetResponse `json:"budgets"`
}

func NewBulkCreateBudgetsResponse(budgets []*model.Budget) BulkCreateBudgetsResponse {
	items := NewListBudgetsResponse(budgets).Data
	return BulkCreateBudgetsResponse{CreatedCount: len(items), Budgets: items}
}
