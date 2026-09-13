package dto

import (
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// PresetShareResponse is one line of a lifestyle preset, sent to the client so
// screen 2 can preview what each option will produce without a round trip.
type PresetShareResponse struct {
	SystemKey string `json:"system_key"`
	Percent   int64  `json:"percent"`
}

// PresetResponse is one of the four lifestyle answers on wizard screen 2.
type PresetResponse struct {
	Key    string                `json:"key"`
	Shares []PresetShareResponse `json:"shares"`
}

// BudgetWizardPrefillResponse is the body of GET /ai/budget-wizard/prefill — a
// pure read: no AI Service call, no chat_messages write.
type BudgetWizardPrefillResponse struct {
	Currency string `json:"currency"`
	// Default pay day. The client may change it; 1 reproduces the calendar
	// month, which is what every pre-v2 query assumed.
	CycleStartDay int `json:"cycle_start_day"`
	// Where the savings slider starts — 10%, not the textbook 20%. See
	// common.BudgetWizardDefaultSavingsPct for why.
	DefaultSavingsPct int64                `json:"default_savings_pct"`
	Presets           []PresetResponse     `json:"presets"`
	Categories        []CategoryResponse   `json:"categories"`
	ExistingBudgets   []BudgetResponse     `json:"existing_budgets"`
}

func NewBudgetWizardPrefillResponse(currency string, categories []*model.Category, existingBudgets []*model.Budget) BudgetWizardPrefillResponse {
	presets := make([]PresetResponse, 0, len(common.BudgetPresets))
	for _, p := range common.BudgetPresets {
		shares := make([]PresetShareResponse, 0, len(p.Shares))
		for _, s := range p.Shares {
			shares = append(shares, PresetShareResponse{SystemKey: s.SystemKey, Percent: s.Percent})
		}
		presets = append(presets, PresetResponse{Key: string(p.Key), Shares: shares})
	}

	return BudgetWizardPrefillResponse{
		Currency:          currency,
		CycleStartDay:     common.BudgetWizardDefaultCycleStartDay,
		DefaultSavingsPct: common.BudgetWizardDefaultSavingsPct,
		Presets:           presets,
		Categories:        NewListCategoriesResponse(categories).Data,
		ExistingBudgets:   NewListBudgetsResponse(existingBudgets).Data,
	}
}

// ProposalEntry is one category's finished proposal.
//
// It carries a BAND, not a single number. A first budget is an estimate, and a
// lone figure invites the user to read it as a commitment — so spending 3% over
// has to be called a failure, which it is not. The band lets "slightly above the
// middle" stay neutral and keeps "vượt" for when it is true.
//
// AmountMax is the figure written to budget_limits.amount_limit. AmountMin is
// display and spend-classification only.
type ProposalEntry struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	SystemKey    string    `json:"system_key,omitempty"`
	AmountMin    int64     `json:"amount_min"`
	AmountMax    int64     `json:"amount_max"`
	// preset | stated | manual | history — drives the row's confidence badge.
	Source string `json:"source"`
	Locked bool   `json:"locked"`
	// 0..1.
	Confidence float64 `json:"confidence"`
	// Concrete grounding, or empty. Empty means the row shows its badge and
	// nothing else — v1 printed "AI đề xuất mức chi tiêu tiêu biểu…" on every
	// row, which said nothing and made grounded rows indistinguishable from
	// guesses.
	Evidence string `json:"evidence,omitempty"`
}

// BudgetProposalsResponse is POST /ai/budget-proposals' 200 body.
type BudgetProposalsResponse struct {
	// income − fixed_total − savings_target. Savings is deducted BEFORE this,
	// not budgeted as a category: money already committed to savings is not
	// available to spend, and listing it beside the spending categories invites
	// treating it as the one to raid.
	Disposable int64           `json:"disposable"`
	Proposals  []ProposalEntry `json:"proposals"`
	// The buffer, plus rounding remainder, plus anything a ceiling clipped.
	// ⚠️ Not a category: no transaction can be filed against it.
	//
	// Invariant: sum(proposals.amount_max) + unallocated_amount == disposable,
	// exactly.
	UnallocatedAmount int64 `json:"unallocated_amount"`
	// The user's own pinned amounts already exceed what can be allocated. The
	// server reports it instead of shrinking them — they stated absolute
	// figures, and quietly overriding a stated figure destroys the instruction.
	OverCommitted bool  `json:"over_committed"`
	Shortfall     int64 `json:"shortfall"`
	// True only when at least one xu was actually removed. v1 set this whenever
	// its reduction loop ran, so the UI warned about a scale-down that had not
	// happened.
	ScaledDown bool `json:"scaled_down"`
}

// SuggestCategoryNameResponse is POST /ai/suggest-category-name's 200 body —
// the one LLM-backed call in this feature.
type SuggestCategoryNameResponse struct {
	SuggestedName string `json:"suggested_name"`
	Type          string `json:"type"`
	Icon          string `json:"icon"`
}
