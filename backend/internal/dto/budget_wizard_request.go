package dto

import (
	"github.com/google/uuid"
)

// CategoryIntentRequest is one category the user wants budgeted, in the shape
// POST /ai/budget-proposals now accepts (specs/ai-budget-wizard-v2/spec.md
// US-07).
//
// Replaces v1's BudgetPreference, which asked the user to pick a spending tier
// ("very_little" … "priority") for every category — up to 120 decisions, each
// of which only has an answer if the user already knows their own spending.
// The users who install a budgeting app are precisely the ones who do not.
//
// `source` decides where the amount comes from:
//   - "preset": amounts arrive as 0 and the engine fills them from the chosen
//     lifestyle profile's share of disposable.
//   - "stated" / "manual": the user gave the figure; it is used as-is.
type CategoryIntentRequest struct {
	CategoryID   uuid.UUID `json:"category_id" validate:"required"`
	CategoryName string    `json:"category_name" validate:"required"`
	// The stable key from migration 019. Presets resolve through this, never
	// through the display name — a name match breaks the moment a category is
	// renamed, and matching keywords against names is what made v1's allocation
	// non-deterministic.
	SystemKey string `json:"system_key"`
	Source    string `json:"source" validate:"required,oneof=preset stated manual history"`
	// xu. Zero is legal for source=preset and means "derive it".
	AmountMin int64 `json:"amount_min" validate:"gte=0"`
	AmountMax int64 `json:"amount_max" validate:"gte=0"`
	// The user pinned this figure: it is not scaled and not rounded.
	Locked bool `json:"locked"`
}

// BudgetProposalsRequest is the body of POST /ai/budget-proposals.
//
// ⚠️ Every amount is xu. The income cap is 999_999_999_900 xu = 9.999.999.999đ.
// v1's tag read `lte=9999999999`, which is that figure in đồng sitting in a xu
// field — so the real ceiling was about 100 triệu/tháng, and anyone above it was
// rejected with a validation error they had no way to interpret.
type BudgetProposalsRequest struct {
	Income        int64 `json:"income" validate:"required,gt=0,lte=999999999900"`
	FixedTotal    int64 `json:"fixed_total" validate:"gte=0"`
	SavingsTarget int64 `json:"savings_target" validate:"gte=0"`

	Currency string `json:"currency" validate:"required,oneof=VND USD"`
	// ⚠️ monthly only. v1 accepted weekly/quarterly here while budgets.period's
	// CHECK constraint accepted only 'monthly' and the mobile client assumed
	// monthly throughout — three sources disagreeing about the same field.
	Period string `json:"period" validate:"required,oneof=monthly"`
	// Pay day, 1–28. Days 29–31 are rejected rather than clamped: silently
	// moving someone's pay cycle is worse than asking them to pick again.
	CycleStartDay int `json:"cycle_start_day" validate:"required,gte=1,lte=28"`

	ProfilePreset string                  `json:"profile_preset" validate:"omitempty,oneof=rented_eating_out with_family own_family student"`
	Intents       []CategoryIntentRequest `json:"intents" validate:"required,min=1,max=20,dive"`
}

// SuggestCategoryNameRequest is the body of POST /ai/suggest-category-name.
type SuggestCategoryNameRequest struct {
	Description string `json:"description" validate:"required,max=200"`
}
