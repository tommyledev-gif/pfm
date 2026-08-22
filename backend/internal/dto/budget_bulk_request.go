package dto

import (
	"github.com/google/uuid"
)

// BulkLimitItem is one currency's ceiling on a bulk-created Budget — an
// array, not the map[string]int64 shape CreateBudgetRequest uses, matching
// specs/ai-budget-wizard/spec.md US-05 Preconditions' wire shape exactly.
type BulkLimitItem struct {
	Currency    string `json:"currency" validate:"required,oneof=VND USD"`
	AmountLimit int64  `json:"amount_limit" validate:"required,gt=0"`
}

// BulkBudgetItem is one Budget to create as part of POST /budgets/bulk.
// Deliberately has no start_date field at all — every created Budget gets
// the server's own current date (specs/ai-budget-wizard/spec.md US-05
// Preconditions, plan.md Domain Objects note).
type BulkBudgetItem struct {
	CategoryID uuid.UUID       `json:"category_id" validate:"required"`
	Period     string          `json:"period" validate:"required,oneof=monthly weekly quarterly"`
	Limits     []BulkLimitItem `json:"limits" validate:"required,min=1,dive"`
}

// BulkCreateBudgetsRequest is the body of POST /budgets/bulk
// (specs/ai-budget-wizard/spec.md US-05 Preconditions). The 20-item cap is
// deliberately NOT a struct tag here — it's enforced at handler level with
// the custom 422 TOO_MANY_BUDGETS error code instead of the generic 400
// INVALID_INPUT a `max=20` validator tag would produce (plan.md Business
// Rules / Error Flows).
type BulkCreateBudgetsRequest struct {
	Budgets []BulkBudgetItem `json:"budgets" validate:"required,min=1,dive"`
}
