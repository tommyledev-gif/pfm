package budgetproposal

import "sort"

// roundStep is the rounding granularity for an amount, in xu.
//
// This is a business rule, not a formatting nicety. "3.087.425đ" is arithmetic
// output; nobody plans against it, and seeing it tells the user the number was
// computed rather than decided. Rounding to a VND-shaped step turns the same
// figure into "3.100.000đ", which reads as a decision.
//
// The ladder in đồng: under 100k rounds to 5k, under 1tr to 10k, under 10tr to
// 50k, above that to 100k. Every bound below is that figure in xu.
func roundStep(amountXu int64) int64 {
	switch {
	case amountXu < 10_000_000: // < 100.000đ
		return 500_000 // 5.000đ
	case amountXu < 100_000_000: // < 1.000.000đ
		return 1_000_000 // 10.000đ
	case amountXu < 1_000_000_000: // < 10.000.000đ
		return 5_000_000 // 50.000đ
	default:
		return 10_000_000 // 100.000đ
	}
}

// quantize rounds every amount onto its step, then hands the rounding remainder
// back by largest-remainder so the total stays as close to the raw total as the
// cap allows.
//
// Guarantees, each covered by its own property test:
//   - every unlocked amount is an exact multiple of its own step
//   - no amount ends below `floor`
//   - the total never exceeds `cap`
//   - a locked amount comes back bit-identical
//   - the same input always produces the same output
func quantize(raw []int64, locked []bool, floor, cap int64) []int64 {
	n := len(raw)
	out := make([]int64, n)
	step := make([]int64, n)
	rem := make([]int64, n)
	var total int64

	for i := range raw {
		if locked[i] {
			// The user's own number. Not rounded, not nudged — rounding "đúng
			// 500k" to 510k is the app overruling an explicit instruction.
			out[i] = raw[i]
			total += out[i]
			continue // step[i] stays 0, which excludes it from the pass below
		}

		// ⚠️ The step is frozen from the RAW amount, not recomputed from the
		// rounded one. An amount sitting just above a ladder boundary rounds
		// down across it, which would then select a smaller step, which would
		// round it differently — the value oscillates instead of settling.
		s := roundStep(raw[i])
		step[i] = s
		out[i] = raw[i] / s * s
		if out[i] < floor {
			// Round the floor UP onto the step rather than using it directly,
			// so the "multiple of step" guarantee holds for clamped rows too.
			out[i] = (floor + s - 1) / s * s
		}
		rem[i] = raw[i] - out[i]
		total += out[i]
	}

	// Largest-remainder: give a step back to whoever lost the most to rounding.
	// Ties break on index, which ResolveIntents has already made deterministic.
	order := make([]int, n)
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool { return rem[order[a]] > rem[order[b]] })

	for _, i := range order {
		if step[i] == 0 {
			continue // locked
		}
		if rem[i]*2 < step[i] {
			// Lost less than half a step — rounding down is the closer answer.
			continue
		}
		if total+step[i] > cap {
			continue
		}
		out[i] += step[i]
		total += step[i]
	}

	return out
}
