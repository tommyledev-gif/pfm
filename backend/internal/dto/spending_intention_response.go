package dto

import (
	"time"

	"github.com/google/uuid"
)

// SpendingIntentionResponse is one kept (or, inside a consult reply, proposed)
// spending intention. All amounts are int64 xu. TargetMonth is "YYYY-MM".
type SpendingIntentionResponse struct {
	// ID is nil on a proposal that has not been kept yet.
	ID                *uuid.UUID `json:"id,omitempty"`
	Title             string     `json:"title"`
	Kind              string     `json:"kind"`
	CategoryID        *uuid.UUID `json:"category_id,omitempty"`
	CategoryName      string     `json:"category_name,omitempty"`
	Currency          string     `json:"currency"`
	TotalAmount       *int64     `json:"total_amount,omitempty"`
	MonthlyAmount     *int64     `json:"monthly_amount,omitempty"`
	InstallmentMonths *int       `json:"installment_months,omitempty"`
	TargetMonth       string     `json:"target_month"`
	Note              *string    `json:"note,omitempty"`
	CreatedAt         *time.Time `json:"created_at,omitempty"`
	UpdatedAt         *time.Time `json:"updated_at,omitempty"`
	// Assessment is computed when the response is built, never stored.
	Assessment IntentionAssessment `json:"assessment"`
}

// IntentionAssessment is how one intention sits against the User's own
// records. Every amount is xu, computed from Transactions and Budgets — never
// from the language model. Pointers are nil when the figure cannot be worked
// out (no price, no history, no Budget), so the client leaves the line out
// instead of showing a zero that means something else.
//
// Rounding (spec.md A-07), on the app's suggested steps: the average income and
// spending to nearest, the surplus and what is left after other intentions
// down, a shortfall up. Budget figures are read as they are.
type IntentionAssessment struct {
	Currency string `json:"currency"`
	// Months the plan takes payments in; 1 for a one-time purchase.
	Months int `json:"months"`
	// MonthlyBurden is what one month pays: the price, or the instalment.
	MonthlyBurden *int64 `json:"monthly_burden,omitempty"`
	// Total is what the whole plan costs: the stated total, else the burden times the months.
	Total *int64 `json:"total,omitempty"`
	// AssessedMonth is the month the figures are for ("YYYY-MM"): the plan's
	// own month, or the current cycle's when that has passed.
	AssessedMonth  string `json:"assessed_month"`
	BaselineCycles int    `json:"baseline_cycles"`
	AvgIncome      *int64 `json:"avg_income,omitempty"`
	AvgExpense     *int64 `json:"avg_expense,omitempty"`
	// Surplus is the usual income minus the usual spending.
	Surplus *int64 `json:"surplus,omitempty"`
	// OtherPlanned is what the other kept intentions take in the assessed month.
	OtherPlanned int64 `json:"other_planned"`
	// Headroom is what the surplus leaves after OtherPlanned; may be negative.
	Headroom *int64 `json:"headroom,omitempty"`
	// FitsSurplus compares MonthlyBurden with Headroom; nil when either is missing.
	FitsSurplus *bool `json:"fits_surplus,omitempty"`
	// ShortSurplus is by how much the burden exceeds Headroom, when it does.
	ShortSurplus *int64 `json:"short_surplus,omitempty"`
	// Budget is the linked Category's Budget this cycle; present only when the
	// assessed month is the current cycle.
	Budget      *IntentionBudget `json:"budget,omitempty"`
	FitsBudget  *bool            `json:"fits_budget,omitempty"`
	ShortBudget *int64           `json:"short_budget,omitempty"`
}

// IntentionBudget is the linked Category's Budget as it stands for one month,
// weighed against everything planned in that Category.
//
// Basis says where Spent comes from: "this_cycle" is the real spending so far
// this cycle, exactly as the Budgets screen shows it; "usual" is what the
// Category averages over the recent completed cycles (the month is a later
// one, so there is no real figure yet); "limit" is only the limit, because
// there is no history to take a usual from. Left is what the Budget leaves
// after Spent and after the other plans in the same Category; nil when Spent
// is unknown.
type IntentionBudget struct {
	CategoryName string `json:"category_name"`
	Limit        int64  `json:"limit"`
	Basis        string `json:"basis"`
	Spent        int64  `json:"spent"`
	// Remaining is Limit minus Spent (what the Budgets screen calls remaining).
	Remaining    int64  `json:"remaining"`
	OtherPlanned int64  `json:"other_planned"`
	Left         *int64 `json:"left,omitempty"`
}

// SpendingIntentionListResponse is the list, soonest month first, and what
// all of it adds up to against the User's own records.
type SpendingIntentionListResponse struct {
	Items      []SpendingIntentionResponse `json:"items"`
	Portfolios []IntentionPortfolio        `json:"portfolios"`
}

// IntentionPortfolio is everything planned in one currency, weighed together
// month by month against the usual surplus and against each Budget the plans
// touch (spec.md A-08). Amounts are xu; Months holds only months that pay
// something, soonest first.
type IntentionPortfolio struct {
	Currency       string               `json:"currency"`
	Count          int                  `json:"count"`
	BaselineCycles int                  `json:"baseline_cycles"`
	AvgIncome      *int64               `json:"avg_income,omitempty"`
	AvgExpense     *int64               `json:"avg_expense,omitempty"`
	Surplus        *int64               `json:"surplus,omitempty"`
	Months         []IntentionMonthLoad `json:"months"`
}

// IntentionMonthLoad is what all plans take in one month.
type IntentionMonthLoad struct {
	Month   string `json:"month"`
	Planned int64  `json:"planned"`
	// Headroom is what the usual surplus leaves after Planned; may be negative.
	Headroom     *int64                `json:"headroom,omitempty"`
	FitsSurplus  *bool                 `json:"fits_surplus,omitempty"`
	ShortSurplus *int64                `json:"short_surplus,omitempty"`
	Budgets      []IntentionBudgetLoad `json:"budgets"`
}

// IntentionBudgetLoad is one Budget against everything planned in its
// Category that month: OtherPlanned here is the whole of it.
type IntentionBudgetLoad struct {
	IntentionBudget
	Fits  *bool  `json:"fits,omitempty"`
	Short *int64 `json:"short,omitempty"`
}

// ConsultIntentions is the proposal a consult reply of kind "intention"
// carries: one draft per item the sentence named, each the User can keep, edit
// or discard, and what they all add up to together with what is already kept.
type ConsultIntentions struct {
	Items      []ConsultIntentionDraft `json:"items"`
	Portfolios []IntentionPortfolio    `json:"portfolios"`
	// Truncated is set when the sentence named more items than one message
	// takes: only the first ones became drafts.
	Truncated bool `json:"truncated,omitempty"`
	// Skipped counts items that could not be read (no name, an absurd amount).
	Skipped int `json:"skipped,omitempty"`
}

// ConsultIntentionDraft is one proposed intention.
type ConsultIntentionDraft struct {
	Draft SpendingIntentionResponse `json:"draft"`
	// MonthMoved is set when a month in the past was read and the current
	// cycle was used instead (spec.md EC-01).
	MonthMoved bool `json:"month_moved,omitempty"`
}
