// Package budgetproposal implements F-13 AI Budget Setup Wizard's
// allocation-proposal formula (specs/ai-budget-wizard/spec.md US-04 Main Flow
// step 3) — a fixed, deterministic, rule-based calculation. No pgx/fiber/
// network import: this is pure arithmetic over its own inputs, callable
// directly from BudgetWizardService with no AI Service round-trip
// (specs/ai-budget-wizard/plan.md Finding #6).
package budgetproposal

import (
	"fmt"
	"sort"
	"strings"

	"github.com/example/pfm/backend/internal/common"
)

// Input is one selected Category's spending preference, the shape
// BudgetWizardService.Proposals passes in after re-validating category
// ownership — CategoryID is an opaque string here (already validated
// upstream as a real uuid.UUID by the caller), never re-parsed by this
// package.
type Input struct {
	CategoryID         string
	CategoryName       string
	SpendingPreference string
}

// Entry is one Category's computed proposal.
type Entry struct {
	CategoryID      string
	CategoryName    string
	Amount          int64
	PercentOfIncome float64
	Reasoning       string
}

// Result is Compute's full output — UnallocatedAmount is always shown to the
// User, never silently redistributed (spec.md US-04 Main Flow step 3).
// ScaledDown is set only when Edge Case #3 (a very small income with many
// selected Categories) forced amounts below what their preference alone
// would have produced, even after the minimum-floor clamp.
type Result struct {
	Entries            []Entry
	UnallocatedAmount  int64
	UnallocatedPercent float64
	ScaledDown         bool
}

// rankForOrdering assigns a numeric rank used only to decide *which* Category
// loses budget first when Edge Case #3's final excess-reduction pass has to
// run (spec.md US-04 Edge Cases #3: "starting from the lowest-preference
// Category first"). Spec text does not say where "ai_decides" ranks relative
// to the named weight tiers — implementation-level tie-break, documented
// here rather than silently guessed: treated as equivalent to "normal", since
// it represents a fixed needs-based share rather than an explicit priority
// choice from the User.
func rankForOrdering(preference string) float64 {
	if w, ok := common.BudgetWizardPreferenceWeights[preference]; ok {
		return w
	}
	return common.BudgetWizardPreferenceWeights["normal"]
}

// Compute runs the fixed allocation formula. income must be > 0 (guaranteed
// by dto.BudgetProposalsRequest's validator tags) and items must be
// non-empty.
func Compute(income int64, items []Input) Result {
	n := len(items)
	amounts := make([]float64, n)
	isAIDecides := make([]bool, n)

	// Step 1/2: weight lookup for explicit preferences, baseline-pattern
	// lookup for "ai_decides" — spec.md US-04 Main Flow step 3, bullets 1-2.
	weights := make([]float64, n)
	baselines := make([]float64, n)
	var sumBaselines float64
	for i, item := range items {
		if item.SpendingPreference == "ai_decides" {
			isAIDecides[i] = true
			baselines[i] = categoryBaseline(item.CategoryName) * float64(income)
			sumBaselines += baselines[i]
		} else {
			weights[i] = common.BudgetWizardPreferenceWeights[item.SpendingPreference]
		}
	}

	// Step 3 guardrail: if ai_decides baselines alone exceed 90% of income,
	// scale them down proportionally (spec.md S-BWZ-19).
	weightedPool := common.BudgetWizardWeightedPoolShare * float64(income)
	if sumBaselines > weightedPool {
		factor := weightedPool / sumBaselines
		for i := range items {
			if isAIDecides[i] {
				baselines[i] *= factor
			}
		}
		sumBaselines = weightedPool
	}

	// Step 3: weighted Categories split what's left of the 90% pool,
	// proportional to weight.
	remainingPool := weightedPool - sumBaselines
	if remainingPool < 0 {
		remainingPool = 0
	}
	var sumWeights float64
	for i := range items {
		if !isAIDecides[i] {
			sumWeights += weights[i]
		}
	}
	for i := range items {
		if isAIDecides[i] {
			amounts[i] = baselines[i]
		} else if sumWeights > 0 {
			amounts[i] = remainingPool * (weights[i] / sumWeights)
		}
	}

	// Step 4a: maximum-per-Category ceiling — lifted entirely for a single
	// selected Category (spec.md S-BWZ-14). Excess removed here becomes
	// unallocated, never redistributed to other Categories (same "never
	// silently distributed" principle applied to the remainder itself).
	if n > 1 {
		ceiling := common.BudgetWizardMaxShareOfIncome * float64(income)
		for i := range amounts {
			if amounts[i] > ceiling {
				amounts[i] = ceiling
			}
		}
	}

	// Step 4b: minimum-per-Category floor, raising any amount below it and
	// shrinking the rest proportionally to make room (spec.md US-04 Main Flow
	// step 3: "scaling other amounts down if needed to make room").
	floor := float64(common.BudgetWizardMinAmountPerCategory)
	applyFloor(amounts, floor)

	// Edge Case #3: a very small income with many selected Categories can
	// still leave the total above 90% of income even after the floor clamp —
	// reduce starting from the lowest-preference Category first.
	scaledDown := enforceUnallocatedFloor(amounts, items, income, floor)

	total := 0.0
	for _, a := range amounts {
		total += a
	}
	unallocated := float64(income) - total

	entries := make([]Entry, n)
	for i, item := range items {
		entries[i] = Entry{
			CategoryID:      item.CategoryID,
			CategoryName:    item.CategoryName,
			Amount:          int64(amounts[i]),
			PercentOfIncome: safeDiv(amounts[i], float64(income)),
			Reasoning:       reasoningFor(item, isAIDecides[i]),
		}
	}

	return Result{
		Entries:            entries,
		UnallocatedAmount:  int64(unallocated),
		UnallocatedPercent: safeDiv(unallocated, float64(income)),
		ScaledDown:         scaledDown,
	}
}

// applyFloor raises every amount below floor up to it, shrinking the
// above-floor amounts proportionally to make room. Iterates because raising
// one entry's floor can itself push another below its own floor once the
// pool shrinks — converges in at most len(amounts) passes.
func applyFloor(amounts []float64, floor float64) {
	fixed := make([]bool, len(amounts))
	for pass := 0; pass < len(amounts)+1; pass++ {
		var deficit float64
		anyBelow := false
		for i, a := range amounts {
			if !fixed[i] && a < floor {
				deficit += floor - a
				amounts[i] = floor
				fixed[i] = true
				anyBelow = true
			}
		}
		if !anyBelow {
			return
		}

		var shrinkPool float64
		for i, a := range amounts {
			if !fixed[i] {
				shrinkPool += a
			}
		}
		if shrinkPool <= 0 {
			return // nothing left to shrink — accept the shortfall as-is
		}
		for i, a := range amounts {
			if !fixed[i] {
				amounts[i] = a - deficit*(a/shrinkPool)
			}
		}
	}
}

// enforceUnallocatedFloor keeps the remainder at or above
// BudgetWizardMinUnallocatedShare of income, reducing amounts starting from
// the lowest-preference Category first once every other guardrail has
// already run (spec.md US-04 Edge Cases #3). Never reduces an entry below
// the minimum floor — if even every entry at its floor still leaves the
// remainder short, the shortfall is accepted as-is (an extreme
// small-income-many-categories case with no further room to give).
func enforceUnallocatedFloor(amounts []float64, items []Input, income int64, floor float64) bool {
	total := 0.0
	for _, a := range amounts {
		total += a
	}
	maxAllocatable := (1 - common.BudgetWizardMinUnallocatedShare) * float64(income)
	excess := total - maxAllocatable
	if excess <= 0 {
		return false
	}

	order := make([]int, len(amounts))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool {
		return rankForOrdering(items[order[a]].SpendingPreference) < rankForOrdering(items[order[b]].SpendingPreference)
	})

	for _, i := range order {
		if excess <= 0 {
			break
		}
		room := amounts[i] - floor
		if room <= 0 {
			continue
		}
		take := room
		if take > excess {
			take = excess
		}
		amounts[i] -= take
		excess -= take
	}
	return true
}

// categoryBaseline matches a Category's name against
// common.BudgetWizardCategoryBaselines' keyword patterns (case-insensitive
// substring match), falling back to common.BudgetWizardDefaultBaseline when
// nothing matches (spec.md US-04 Main Flow step 3: "unmatched ≈ 5%").
func categoryBaseline(categoryName string) float64 {
	lower := strings.ToLower(categoryName)
	for pattern, share := range common.BudgetWizardCategoryBaselines {
		if strings.Contains(lower, pattern) {
			return share
		}
	}
	return common.BudgetWizardDefaultBaseline
}

// reasoningFor builds the one-line, rule-based (never LLM-generated)
// explanation string returned alongside each proposed amount (spec.md
// US-04 Main Flow step 4).
func reasoningFor(item Input, isAIDecides bool) string {
	if isAIDecides {
		return fmt.Sprintf("AI đề xuất mức chi tiêu tiêu biểu cho danh mục %q dựa trên tỷ lệ ngân sách thông thường.", item.CategoryName)
	}
	return fmt.Sprintf("Dựa trên mức độ ưu tiên bạn chọn (%s) cho danh mục %q.", item.SpendingPreference, item.CategoryName)
}

func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}
