package dto

import (
	"fmt"
	"sort"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
)

// CreateBudgetRequest is the body of POST /budgets. `limits` cannot be
// expressed as a validator/v10 struct tag (map-key validation) — see
// ValidateLimits below (specs/budget-management/plan.md Finding #5).
// `period` defaults to "monthly" and `start_date` to today when omitted,
// applied in BudgetService, not here (shape validation only, per CLAUDE.md's
// handler/service split).
type CreateBudgetRequest struct {
	CategoryID uuid.UUID        `json:"category_id" validate:"required"`
	Limits     map[string]int64 `json:"limits"`
	Period     *string          `json:"period" validate:"omitempty,oneof=monthly"`
	StartDate  *string          `json:"start_date" validate:"omitempty,datetime=2006-01-02"`
}

// UpdateBudgetRequest is the body of PATCH /budgets/{id}. Deliberately has no
// category_id/period/start_date field at the type level (spec.md: "never
// accepted by this endpoint") — decoded via the existing dto.DecodeStrict so
// an unrecognized field is rejected with 400, not silently ignored. `limits`
// is a FULL REPLACEMENT of the Budget's currency entries, never a
// per-currency merge (spec.md Edge Case US-04 #1).
type UpdateBudgetRequest struct {
	Limits map[string]int64 `json:"limits"`
}

// HasUpdates reports whether a `limits` key was supplied at all — an empty
// body (no key) is a client mistake (400), not a no-op 200 (spec.md
// S-BUD-36). An explicitly empty map (`{}`) is caught by ValidateLimits
// instead (S-BUD-30) — HasUpdates only distinguishes "key absent" from
// "key present".
func (r UpdateBudgetRequest) HasUpdates() bool {
	return r.Limits != nil
}

// limitFieldError is one entry in ValidateLimits' `details` array — every
// failing currency is reported at once, not just the first (implementation-checklist:
// "independent business-rule checks... collected and returned together").
type limitFieldError struct {
	Currency string `json:"currency"`
	Reason   string `json:"reason"`
}

// ValidateLimits enforces spec.md's US-01/US-04 shape rules for `limits`:
// non-empty, every key a currency in common.SupportedCurrencies, every value
// a positive non-zero integer. Handler-level (CLAUDE.md: shape/type
// validation belongs at the handler, never the service). Each currency
// entry is an independent check — every failing one is collected into a
// single 400 response, not returned one at a time.
func ValidateLimits(limits map[string]int64) *common.AppError {
	if len(limits) == 0 {
		return common.NewInvalidInputError("at least one currency limit is required")
	}

	currencies := make([]string, 0, len(limits))
	for currency := range limits {
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)

	var details []limitFieldError
	for _, currency := range currencies {
		amount := limits[currency]
		switch {
		case !common.SupportedCurrencies[currency]:
			details = append(details, limitFieldError{Currency: currency, Reason: fmt.Sprintf("currency %q is not supported", currency)})
		case amount <= 0:
			details = append(details, limitFieldError{Currency: currency, Reason: fmt.Sprintf("limit for %q must be greater than 0", currency)})
		}
	}
	if len(details) > 0 {
		return common.NewInvalidInputErrorWithDetails("one or more currency limits are invalid", details)
	}
	return nil
}
