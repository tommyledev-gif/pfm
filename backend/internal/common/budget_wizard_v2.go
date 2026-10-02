package common

// F-13.1 AI Budget Setup Wizard v2 — Phase 1 constants
// (specs/ai-budget-wizard-v2/spec.md, plan.md BWZ2-T10).
//
// Every amount here is xu (integer cents), the unit the whole system already
// stores money in. The v2 draft proposed switching the planning layer to đồng;
// spec.md A-01 rejected that — budget_limits.amount_limit is xu, so a planner
// working in đồng would be a silent 100x error on every user-visible figure.
//
// Shares are integer numerator/denominator pairs rather than float64 ratios.
// That is not stylistic: the v1 engine multiplied money by float64 shares and
// truncated, which is how `sum(entries) + unallocated != income` (bug B2) got
// in. Integer ratios make the arithmetic exact and the invariant checkable.

const (
	// BudgetWizardMinAmountPerCategoryXu — 50.000đ. No category is worth
	// tracking below this: it is roughly one coffee, and a limit that a single
	// ordinary purchase blows through generates a warning the user learns to
	// ignore.
	//
	// ⚠️ Replaces the old BudgetWizardMinAmountPerCategory = 50_000, which was
	// declared int64 xu but carried a đồng figure — so the floor actually in
	// force was 500đ, a hundredth of what the spec intended.
	BudgetWizardMinAmountPerCategoryXu int64 = 5_000_000

	// BudgetWizardIncomeCapXu — 10 tỷ đ. The cap before last (9_999_999_999)
	// was a đồng figure sitting in a xu field, capping real income at ~100
	// triệu/tháng and rejecting anyone above it with a generic validation
	// error they could not act on (spec.md BS-05). Mirrored by the mobile
	// wizard's INCOME_CAP_XU and the dto tag on BudgetProposalsRequest.Income;
	// MulDiv keeps every product of it inside int64.
	BudgetWizardIncomeCapXu int64 = 1_000_000_000_000

	// Share of disposable that may be allocated to categories. The remaining
	// 12% is the buffer — see BudgetWizardBufferNote.
	BudgetWizardAllocatableNum int64 = 88
	BudgetWizardAllocatableDen int64 = 100

	// Per-category ceiling: no single category may exceed half of disposable,
	// unless it is the only category (a one-category plan has nothing to be
	// disproportionate against). Money clipped by this ceiling becomes buffer
	// and is never redistributed — redistributing would inflate categories the
	// user never asked to raise.
	BudgetWizardMaxShareNum int64 = 1
	BudgetWizardMaxShareDen int64 = 2

	// BudgetWizardMinViableDisposableXu — 350.000đ.
	//
	// Derived, not chosen: the smallest preset has 6 categories, each needing
	// the 50.000đ floor, and only 88% of disposable is allocatable. So the real
	// requirement is ceil(6 x 50.000 / 0.88) = 340.910đ, rounded up to a clean
	// 350.000đ. The spec's original 300.000đ was the floor sum without the
	// buffer applied, which meant the engine was forced to report ScaledDown at
	// the exact figure the spec called "enough".
	BudgetWizardMinViableDisposableXu int64 = 35_000_000

	// BudgetWizardDefaultSavingsPct is what the savings slider starts on.
	//
	// Standard personal-finance advice is 20%, and this is deliberately not
	// that. A user who has never tracked their spending, committing 20% on top
	// of costs they have not measured yet, breaks the plan in week two — and a
	// plan that breaks is a user who stops opening the app. 10% is a rate
	// almost anyone can actually hold. Phase 2's end-of-cycle check proposes
	// raising it once the data shows slack, which gets to 20% by succeeding
	// rather than by failing first.
	BudgetWizardDefaultSavingsPct int64 = 10

	// BudgetWizardDefaultCycleStartDay is the pay day assumed when the user
	// does not change it — the calendar month, which is what every pre-v2
	// query already assumed.
	BudgetWizardDefaultCycleStartDay = 1
)

// AppTimezone is the single timezone every cycle and day boundary is computed
// in.
//
// ⚠️ Pulled into Phase 1 rather than deferred with the rest of the timezone
// work. Storage stays TIMESTAMPTZ UTC and nothing about the schema changes —
// but a boundary computed in UTC rolls the day over at 07:00 local for a
// Vietnamese user, so between midnight and 7am "hôm nay còn X" would report
// YESTERDAY's remaining budget. That is the single most prominent number this
// feature produces, wrong for 29% of the day. A per-user timezone column is
// still a separate feature; this constant is the one place it will be replaced.
const AppTimezone = "Asia/Ho_Chi_Minh"

// CategoryClass drives the order in which categories give money up when a plan
// has to be cut down (v2 design §7.2): discretionary first, essentials only
// after that, fixed costs never.
type CategoryClass string

const (
	CategoryClassFixed      CategoryClass = "fixed"
	CategoryClassEssential  CategoryClass = "essential"
	CategoryClassDiscretion CategoryClass = "discretion"
)

// SystemCategoryClass maps a category's stable system_key (migration 019) to
// its class. A category with no system_key — anything the user created
// themselves — is deliberately NOT defaulted to `discretion`: discretionary is
// what gets cut first, and cutting a category the user invented, before
// touching one we assigned, is the wrong side to err on. See ClassForSystemKey.
var SystemCategoryClass = map[string]CategoryClass{
	"housing":            CategoryClassFixed,
	"utilities":          CategoryClassFixed,
	"food":               CategoryClassEssential,
	"transport":          CategoryClassEssential,
	"health":             CategoryClassEssential,
	"children_education": CategoryClassEssential,
	"entertainment":      CategoryClassDiscretion,
	"shopping":           CategoryClassDiscretion,
	"other":              CategoryClassDiscretion,
}

// ClassForSystemKey resolves a class for any category, keyed or not.
func ClassForSystemKey(systemKey string) CategoryClass {
	if c, ok := SystemCategoryClass[systemKey]; ok {
		return c
	}
	return CategoryClassEssential
}

// BudgetPresetShare is one line of a lifestyle preset: a category identified by
// its stable key, and its share of DISPOSABLE (not of gross income).
//
// Disposable as the denominator is the substantive change from v1. It keeps the
// percentages stable across income levels — 40% of what's left after rent and
// savings means the same thing to someone earning 8tr and someone earning 25tr,
// where 40% of gross does not — and it forces the "savings comes out first"
// model into the arithmetic instead of leaving it as advice.
type BudgetPresetShare struct {
	SystemKey string
	// Percent of disposable. Every preset's shares sum to exactly 88; the
	// remaining 12 is the buffer.
	Percent int64
}

// BudgetPresetKey identifies one of the lifestyle answers on wizard screen 2 —
// the single question that replaces v1's per-category tier grid.
type BudgetPresetKey string

const (
	BudgetPresetRentedEatingOut BudgetPresetKey = "rented_eating_out"
	BudgetPresetWithFamily      BudgetPresetKey = "with_family"
	BudgetPresetOwnFamily       BudgetPresetKey = "own_family"
	BudgetPresetStudent         BudgetPresetKey = "student"
	// Added after the first four: a couple with no children and a retired
	// user were both answering "own_family" or "with_family" for want of
	// anything closer, which handed them a children_education line they will
	// never spend on — a budget with a category the user cannot use is the
	// fastest way to teach them the plan is not about them.
	BudgetPresetCoupleNoKids BudgetPresetKey = "couple_no_kids"
	BudgetPresetRetired      BudgetPresetKey = "retired"
)

// BudgetPresets is an ORDERED slice, not a map.
//
// ⚠️ This ordering is load-bearing. The v1 engine iterated a Go map to match
// category keywords, and Go randomizes map iteration order — so a category
// matching two patterns resolved differently between runs, and the same input
// produced different budgets. The comment above that map claimed order was
// insignificant. It was not. Anything that feeds the allocator must iterate
// deterministically.
//
// Each preset holds at most 6 categories on purpose: every category is another
// line that can be breached, and a plan with ten lines almost certainly breaches
// one every month, which trains the user to ignore the warning.
var BudgetPresets = []struct {
	Key    BudgetPresetKey
	Shares []BudgetPresetShare
}{
	{
		Key: BudgetPresetRentedEatingOut,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 40},
			{SystemKey: "entertainment", Percent: 14},
			{SystemKey: "transport", Percent: 11},
			{SystemKey: "shopping", Percent: 11},
			{SystemKey: "other", Percent: 8},
			{SystemKey: "health", Percent: 4},
		},
	},
	{
		Key: BudgetPresetWithFamily,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 26},
			{SystemKey: "entertainment", Percent: 20},
			{SystemKey: "shopping", Percent: 17},
			{SystemKey: "transport", Percent: 12},
			{SystemKey: "other", Percent: 8},
			{SystemKey: "health", Percent: 5},
		},
	},
	{
		Key: BudgetPresetOwnFamily,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 34},
			{SystemKey: "children_education", Percent: 20},
			{SystemKey: "transport", Percent: 10},
			{SystemKey: "shopping", Percent: 9},
			{SystemKey: "health", Percent: 8},
			{SystemKey: "other", Percent: 7},
		},
	},
	{
		Key: BudgetPresetStudent,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 40},
			{SystemKey: "entertainment", Percent: 17},
			{SystemKey: "children_education", Percent: 12},
			{SystemKey: "transport", Percent: 8},
			{SystemKey: "shopping", Percent: 6},
			{SystemKey: "other", Percent: 5},
		},
	},
	{
		// Two incomes, no children: the money own_family spends on
		// children_education shows up here as eating out and going out.
		Key: BudgetPresetCoupleNoKids,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 32},
			{SystemKey: "entertainment", Percent: 18},
			{SystemKey: "shopping", Percent: 14},
			{SystemKey: "transport", Percent: 12},
			{SystemKey: "other", Percent: 7},
			{SystemKey: "health", Percent: 5},
		},
	},
	{
		// The one profile where health is a standing monthly line rather than
		// an occasional one, and transport is the smallest — no commute.
		Key: BudgetPresetRetired,
		Shares: []BudgetPresetShare{
			{SystemKey: "food", Percent: 34},
			{SystemKey: "health", Percent: 20},
			{SystemKey: "other", Percent: 12},
			{SystemKey: "shopping", Percent: 10},
			{SystemKey: "entertainment", Percent: 7},
			{SystemKey: "transport", Percent: 5},
		},
	},
}

// PresetByKey returns the shares for a preset, iterating the ordered slice.
func PresetByKey(key BudgetPresetKey) ([]BudgetPresetShare, bool) {
	for _, p := range BudgetPresets {
		if p.Key == key {
			return p.Shares, true
		}
	}
	return nil, false
}

// ⚠️ The preset percentages above are informed estimates for the Vietnamese
// context, NOT measurements. They set the first-cycle error for every user who
// arrives with no history — the largest group — and no test can detect that they
// are wrong, because there is nothing to compare them against yet. The plan is
// to ship these, then recompute them per profile from real data once ~200 users
// have completed a full cycle. That is a recurring task, not a one-off.
const BudgetWizardBufferNote = "Dự phòng"
