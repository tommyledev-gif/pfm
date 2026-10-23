package common

import ()

// AI Budget Setup Wizard (F-13, specs/ai-budget-wizard). All allocation math
// runs in-process (budgetproposal.Compute) — no LLM/network call for this
// step (plan.md Finding #6).
const (
	// BudgetWizardMaxItems is the 20-Budget-per-request cap shared by
	// POST /ai/budget-proposals' preferences and POST /budgets/bulk's budgets
	// (spec.md S-BWZ-10/S-BWZ-25).
	BudgetWizardMaxItems = 20
	// BudgetWizardMinAmountPerCategory is the floor every proposed amount is
	// clamped up to, scaling other amounts down if needed to make room
	// (spec.md US-04 Main Flow step 3).
	BudgetWizardMinAmountPerCategory int64 = 50_000
	// BudgetWizardMaxShareOfIncome is the per-Category ceiling (50% of
	// income) — a defensive cap only; no preference tier or ai_decides
	// baseline reaches it on its own (spec.md S-BWZ-14 revision, 2026-08-24:
	// the old "lifted for a single Category" exception was a side effect of
	// the previous relative-weight formula, not a deliberate design goal —
	// see BudgetWizardPreferenceTargetShare below).
	BudgetWizardMaxShareOfIncome = 0.5
	// BudgetWizardWeightedPoolShare is the ceiling every Category's *raw*
	// target amount (preference share or ai_decides baseline) is
	// proportionally scaled down to fit under, combined, before any
	// per-Category floor/ceiling clamp runs (spec.md US-04 Main Flow step 3:
	// "if the sum of every raw amount exceeds 90% of income, all of them are
	// scaled down by the same proportional factor").
	BudgetWizardWeightedPoolShare = 0.9
	// BudgetWizardMinUnallocatedShare is the floor the remainder must never
	// go below — shown to the User as "Chưa có ngân sách" (not yet
	// budgeted), never silently distributed (spec.md US-04 Main Flow step 3
	// / S-BWZ-19).
	BudgetWizardMinUnallocatedShare = 0.1
)

// BudgetWizardPreferenceTargetShare maps a spending_preference to its fixed,
// ABSOLUTE target share of income (spec.md US-04 Main Flow step 3, revised
// 2026-08-24) — "ai_decides" is deliberately absent here, it uses
// BudgetWizardCategoryBaselines instead. Each Category gets its own share
// independent of what else is selected: two Categories both set to
// "very_little" each get 5% of income, not an even split of a shared pool
// (the previous BudgetWizardPreferenceWeights design's relative weights only
// meant something when compared against sibling Categories' weights, which
// silently degenerated to an even split whenever every selected Category
// shared the same preference — reported as confusing/incorrect and replaced
// here).
var BudgetWizardPreferenceTargetShare = map[string]float64{
	"very_little": 0.05,
	"little":      0.10,
	"normal":      0.15,
	"a_lot":       0.22,
	"priority":    0.30,
}

// BudgetWizardCategoryBaselines is the fixed baseline share of income per
// Category-name pattern used for "ai_decides" (spec.md US-04 Main Flow step
// 3) — matched case-insensitively against a substring of the Category's
// name; BudgetWizardDefaultBaseline applies when nothing matches. Order is
// insignificant since matches are keyword-based, not positional.
var BudgetWizardCategoryBaselines = map[string]float64{
	"food":      0.25,
	"ăn":        0.25,
	"transport": 0.10,
	"di chuyển": 0.10,
	"housing":   0.15,
	"nhà":       0.15,
	"bill":      0.15,
	"hóa đơn":   0.15,
	"saving":    0.20,
	"tiết kiệm": 0.20,
}

// BudgetWizardDefaultBaseline is the "ai_decides" baseline for a Category
// name that matches none of BudgetWizardCategoryBaselines' patterns
// (spec.md US-04 Main Flow step 3: "unmatched ≈ 5%").
const BudgetWizardDefaultBaseline = 0.05

// BudgetWizardSavingsCategoryNamePatterns is how BudgetWizardService.Proposals
// recognizes a "savings" Category — case-insensitive substring match against
// a Category's name, same technique as categoryBaseline's keyword matching.
// Matches the seeded system Category's name (017_seed_savings_category.sql)
// but also a user's own differently-cased "tiết kiệm"/"Savings" Category, so
// the default-savings injection never double-proposes one the user already
// selected under a slightly different name.
var BudgetWizardSavingsCategoryNamePatterns = []string{"tiết kiệm", "saving"}

// BudgetWizardDefaultSavingsShare is the fixed share of income the wizard
// proposes for Savings by default, when the user didn't already select a
// Savings Category themselves — every user should see a savings line even if
// they never thought to pick one (product decision, not spec-derived).
// Matches BudgetWizardCategoryBaselines["tiết kiệm"]'s own ai_decides value,
// so a user-selected Savings Category and an auto-injected one land on the
// same share.
const BudgetWizardDefaultSavingsShare = 0.20

// SupportedCurrencies is the same {VND, USD} allow-list as Wallet's currency
// (WalletDefaultCurrency above), but expressed as a real Go-side lookup — not
// just a struct-tag oneof — because `limits` map-KEY validation cannot be
// expressed as a validator/v10 struct tag (specs/budget-management/plan.md
// Finding #5). This supersedes the earlier "a Go-side list is dead weight"
// reasoning for Wallet/Category, which only ever needed a struct-tag oneof.
var SupportedCurrencies = map[string]bool{
	"VND": true,
	"USD": true,
}
