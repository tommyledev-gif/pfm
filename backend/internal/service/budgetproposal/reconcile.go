package budgetproposal

import (
	"fmt"

	"github.com/example/pfm/backend/internal/common"
)

// The constraint-settling half of the allocator, split out of compute.go to
// keep both files under the project's 300-line limit. compute.go owns the step
// ORDER; this file owns what each of the money-moving steps actually does.

// centreAmount resolves one intent's starting figure.
func centreAmount(it CategoryIntent, preset common.BudgetPresetKey, disposable int64) (int64, error) {
	if it.AmountMax > 0 {
		return it.AmountMax, nil
	}
	if it.Source != SourcePreset || preset == "" {
		return 0, fmt.Errorf("budgetproposal: intent for category %s has no amount and no preset to derive one from", it.CategoryID)
	}

	shares, ok := common.PresetByKey(preset)
	if !ok {
		return 0, fmt.Errorf("budgetproposal: unknown preset %q", preset)
	}
	for _, s := range shares {
		if s.SystemKey == it.SystemKey {
			// Share of DISPOSABLE, not of gross income — see
			// common.BudgetPresetShare for why the denominator matters.
			return common.MulDiv(disposable, s.Percent, 100), nil
		}
	}
	return 0, fmt.Errorf("budgetproposal: preset %q has no share for category key %q", preset, it.SystemKey)
}

// reconcile drives the floor and ceiling to a fixed point and returns how many
// xu were actually removed.
//
// The two constraints pull against each other: raising a category to the floor
// takes money from somewhere, and taking it can push a donor below the floor in
// turn. Iterating to a fixed point is the honest way to settle that. The bound
// exists so a pathological input cannot spin — it is not expected to be reached,
// and the fuzz test asserts convergence well inside it.
func reconcile(amounts []int64, locked []bool, floor, ceiling int64, singleItem bool) int64 {
	var reduced int64
	maxIter := len(amounts) + 2

	for iter := 0; iter < maxIter; iter++ {
		changed := false

		// Ceiling first. Clipped money goes to the buffer and is deliberately
		// NOT handed to the other categories: the user asked for one category
		// to be large, not for the others to grow.
		if !singleItem {
			for i := range amounts {
				if !locked[i] && amounts[i] > ceiling {
					reduced += amounts[i] - ceiling
					amounts[i] = ceiling
					changed = true
				}
			}
		}

		var deficit int64
		for i := range amounts {
			if !locked[i] && amounts[i] < floor {
				deficit += floor - amounts[i]
				amounts[i] = floor
				changed = true
			}
		}
		if deficit == 0 {
			if !changed {
				break
			}
			continue
		}

		// Fund the floors from whatever headroom the other unlocked categories
		// have above their own floor.
		var pool int64
		for i := range amounts {
			if !locked[i] && amounts[i] > floor {
				pool += amounts[i] - floor
			}
		}
		if pool == 0 {
			break // nothing left to take; the feasibility check above prevents this
		}
		take := deficit
		if take > pool {
			take = pool
		}
		var taken int64
		for i := range amounts {
			if locked[i] || amounts[i] <= floor {
				continue
			}
			headroom := amounts[i] - floor
			cut := common.MulDiv(headroom, take, pool)
			if cut > headroom {
				cut = headroom
			}
			amounts[i] -= cut
			taken += cut
			reduced += cut
		}
		// Integer division leaves a few xu unclaimed. Walk in index order —
		// deterministic, because ResolveIntents fixed the order.
		for i := 0; taken < take; i++ {
			if i >= len(amounts) {
				break
			}
			if locked[i] || amounts[i] <= floor {
				continue
			}
			amounts[i]--
			taken++
			reduced++
		}
	}

	return reduced
}

// bandFloorFor derives the band's lower edge from the already-quantized upper
// edge, keeping it on the same rounding step and never letting it fall under
// the floor or rise above the max.
func bandFloorFor(max int64, source IntentSource, isLocked bool, floor int64) int64 {
	if isLocked || source == SourceStated || source == SourceManual {
		return max
	}
	lo, _ := band(max, source)
	step := roundStep(max)
	lo = lo / step * step
	if lo < floor {
		lo = floor
	}
	if lo > max {
		lo = max
	}
	if lo <= 0 {
		lo = max
	}
	return lo
}
