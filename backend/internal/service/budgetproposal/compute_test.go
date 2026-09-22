package budgetproposal

import (
	"errors"
	"fmt"
	"math/rand"
	"testing"

	"github.com/example/pfm/backend/internal/common"
)

// Every amount in these tests is xu. `d(n)` writes an amount in đồng, which is
// how the specs and the UI talk about money, and converts once at the boundary.
func d(dong int64) int64 { return dong * 100 }

func presetIntents(t *testing.T, key common.BudgetPresetKey) []CategoryIntent {
	t.Helper()
	shares, ok := common.PresetByKey(key)
	if !ok {
		t.Fatalf("unknown preset %q", key)
	}
	out := make([]CategoryIntent, 0, len(shares))
	for i, s := range shares {
		out = append(out, CategoryIntent{
			// Deliberately NOT in preset order: ResolveIntents has to impose
			// its own deterministic order, and a test that feeds them already
			// sorted would never notice if it stopped.
			CategoryID:   fmt.Sprintf("cat-%02d", len(shares)-i),
			CategoryName: s.SystemKey,
			SystemKey:    s.SystemKey,
			Source:       SourcePreset,
		})
	}
	return out
}

func basicInput(income, fixed, savings int64, intents []CategoryIntent, preset common.BudgetPresetKey) PlanInput {
	return PlanInput{Income: income, FixedTotal: fixed, SavingsTarget: savings, Preset: preset, Intents: intents}
}

// ---------------------------------------------------------------------------
// The six invariants. Each is stated in specs/ai-budget-wizard-v2/spec.md US-01
// and each corresponds to a way the v1 engine was wrong.
// ---------------------------------------------------------------------------

// I4 — the one that matters most: allocated + unallocated is EXACTLY disposable.
// v1 computed in float64 and truncated, so money quietly appeared and vanished.
func TestComputeSumInvariantExact(t *testing.T) {
	for _, preset := range []common.BudgetPresetKey{
		common.BudgetPresetRentedEatingOut,
		common.BudgetPresetWithFamily,
		common.BudgetPresetOwnFamily,
		common.BudgetPresetStudent,
		common.BudgetPresetCoupleNoKids,
		common.BudgetPresetRetired,
	} {
		for _, income := range []int64{d(3_000_000), d(8_000_000), d(12_000_000), d(25_000_000), d(100_000_000)} {
			fixed := income / 5
			savings := income / 10
			res, err := Compute(basicInput(income, fixed, savings, presetIntents(t, preset), preset))
			if err != nil {
				t.Fatalf("%s @ %d: %v", preset, income, err)
			}

			var allocated int64
			for _, e := range res.Entries {
				allocated += e.AmountMax
			}
			if allocated+res.UnallocatedAmount != res.Disposable {
				t.Errorf("%s @ %d: allocated(%d) + unallocated(%d) = %d, want disposable %d",
					preset, income, allocated, res.UnallocatedAmount, allocated+res.UnallocatedAmount, res.Disposable)
			}
			if res.UnallocatedAmount < 0 {
				t.Errorf("%s @ %d: negative buffer %d", preset, income, res.UnallocatedAmount)
			}
		}
	}
}

// I1 + I3 — every unlocked amount is a multiple of its own rounding step and
// never below the floor. This is what stops "3.087.425đ" reaching the screen.
func TestComputeAmountsAreRoundAndAboveFloor(t *testing.T) {
	floor := common.BudgetWizardMinAmountPerCategoryXu
	for _, income := range []int64{d(3_000_000), d(12_000_000), d(100_000_000)} {
		res, err := Compute(basicInput(income, income/5, income/10,
			presetIntents(t, common.BudgetPresetRentedEatingOut), common.BudgetPresetRentedEatingOut))
		if err != nil {
			t.Fatalf("income %d: %v", income, err)
		}
		for _, e := range res.Entries {
			if e.AmountMax < floor {
				t.Errorf("income %d: %s below floor: %d", income, e.SystemKey, e.AmountMax)
			}
			if step := roundStep(e.AmountMax); e.AmountMax%step != 0 {
				t.Errorf("income %d: %s = %d is not a multiple of its step %d", income, e.SystemKey, e.AmountMax, step)
			}
			if e.AmountMin > e.AmountMax || e.AmountMin <= 0 {
				t.Errorf("income %d: %s band invalid: %d..%d", income, e.SystemKey, e.AmountMin, e.AmountMax)
			}
		}
	}
}

// I5 — determinism.
//
// ⚠️ This is the regression guard for bug B1. v1 resolved category baselines by
// iterating a Go map, and Go randomizes map order, so a category matching two
// keyword patterns got a different budget run to run. The package documented
// itself as deterministic and was not. 1.000 identical runs is cheap and the
// failure it catches is otherwise close to invisible.
func TestComputeIsDeterministic(t *testing.T) {
	in := basicInput(d(12_000_000), d(2_500_000), d(1_200_000),
		presetIntents(t, common.BudgetPresetRentedEatingOut), common.BudgetPresetRentedEatingOut)

	first, err := Compute(in)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 1000; i++ {
		got, err := Compute(in)
		if err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
		if len(got.Entries) != len(first.Entries) {
			t.Fatalf("run %d: entry count drifted", i)
		}
		for j := range got.Entries {
			if got.Entries[j] != first.Entries[j] {
				t.Fatalf("run %d, entry %d: %+v != %+v", i, j, got.Entries[j], first.Entries[j])
			}
		}
		if got.UnallocatedAmount != first.UnallocatedAmount {
			t.Fatalf("run %d: buffer drifted", i)
		}
	}
}

// I6 — a locked amount survives scaling and rounding untouched. "Đúng 500k"
// has to still read 500k when the screen renders.
func TestComputeLockedAmountsUntouched(t *testing.T) {
	intents := presetIntents(t, common.BudgetPresetRentedEatingOut)
	const lockedAmount = 51_700 * 100 // deliberately not on any rounding step
	intents[0].Source = SourceStated
	intents[0].AmountMax = lockedAmount
	intents[0].Locked = true

	res, err := Compute(basicInput(d(12_000_000), d(2_500_000), d(1_200_000), intents, common.BudgetPresetRentedEatingOut))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range res.Entries {
		if e.Locked {
			if e.AmountMax != lockedAmount {
				t.Errorf("locked amount was changed: got %d, want %d", e.AmountMax, lockedAmount)
			}
			if e.AmountMin != e.AmountMax {
				t.Errorf("a locked amount must have no band, got %d..%d", e.AmountMin, e.AmountMax)
			}
		}
	}
}

// I2 — the fuzz pass. Random incomes and category counts, asserting every
// invariant at once.
//
// ⚠️ The income range runs to the real cap, not to a comfortable round number.
// Money is xu, so every figure is already 100x its đồng value, and the
// proportional-scaling step multiplies an amount by an amount: near the cap that
// intermediate product is ~10^24 against a MaxInt64 of ~9.2x10^18. A fuzz range
// that stops at a billion never reaches the overflow it is supposed to catch —
// the naive expression wraps and returns a NEGATIVE budget, silently.
func TestComputeFuzzInvariants(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	floor := common.BudgetWizardMinAmountPerCategoryXu

	for i := 0; i < 10000; i++ {
		n := 1 + rng.Intn(20)
		income := floor*int64(n)*4 + rng.Int63n(common.BudgetWizardIncomeCapXu/2)
		fixed := rng.Int63n(income / 4)
		savings := rng.Int63n(income / 4)

		intents := make([]CategoryIntent, n)
		for j := range intents {
			intents[j] = CategoryIntent{
				CategoryID:   fmt.Sprintf("c%04d", rng.Intn(100000)),
				CategoryName: "x",
				Source:       SourceStated,
				AmountMax:    floor + rng.Int63n(income/int64(n)+1),
			}
		}

		res, err := Compute(PlanInput{Income: income, FixedTotal: fixed, SavingsTarget: savings, Intents: intents})
		if err != nil {
			if errors.Is(err, ErrDisposableNonPositive) || errors.Is(err, ErrDisposableTooSmall) {
				continue // legitimately refused, not a broken result
			}
			t.Fatalf("case %d: %v", i, err)
		}

		var allocated int64
		for _, e := range res.Entries {
			if e.AmountMax <= 0 {
				t.Fatalf("case %d: non-positive amount %d (income=%d n=%d)", i, e.AmountMax, income, n)
			}
			if e.AmountMin <= 0 || e.AmountMin > e.AmountMax {
				t.Fatalf("case %d: bad band %d..%d", i, e.AmountMin, e.AmountMax)
			}
			allocated += e.AmountMax
		}
		if allocated+res.UnallocatedAmount != res.Disposable {
			t.Fatalf("case %d: sum invariant broken: %d + %d != %d", i, allocated, res.UnallocatedAmount, res.Disposable)
		}
		if res.UnallocatedAmount < 0 {
			t.Fatalf("case %d: negative buffer %d (income=%d n=%d)", i, res.UnallocatedAmount, income, n)
		}
	}
}

// ---------------------------------------------------------------------------
// Named scenarios from the spec.
// ---------------------------------------------------------------------------

// S-BWZ2-08.
func TestComputeRejectsNonPositiveDisposable(t *testing.T) {
	_, err := Compute(basicInput(d(12_000_000), d(12_000_000), d(1_000_000),
		presetIntents(t, common.BudgetPresetRentedEatingOut), common.BudgetPresetRentedEatingOut))
	if !errors.Is(err, ErrDisposableNonPositive) {
		t.Fatalf("got %v, want ErrDisposableNonPositive", err)
	}
}

// S-BWZ2-07 — the user's own pinned figures already exceed what can be
// allocated. Reported, never silently shrunk: they stated absolutes, and
// overriding a stated absolute throws away the instruction.
func TestComputeOverCommittedIsReportedNotScaled(t *testing.T) {
	intents := []CategoryIntent{
		{CategoryID: "a", CategoryName: "a", Source: SourceStated, AmountMax: d(5_000_000), Locked: true},
		{CategoryID: "b", CategoryName: "b", Source: SourceStated, AmountMax: d(5_000_000), Locked: true},
	}
	res, err := Compute(PlanInput{Income: d(10_000_000), Intents: intents})
	if err != nil {
		t.Fatal(err)
	}
	if !res.OverCommitted || res.Shortfall <= 0 {
		t.Fatalf("expected OverCommitted with a shortfall, got %+v", res)
	}
	for _, e := range res.Entries {
		if e.AmountMax != d(5_000_000) {
			t.Errorf("a locked amount was reduced: %d", e.AmountMax)
		}
	}
}

// S-BWZ2-05 — ScaledDown must mean "money was actually taken away". v1 set it
// whenever the reduction loop ran at all, so the UI warned about a scale-down
// that had not happened.
func TestComputeScaledDownOnlyWhenSomethingWasReduced(t *testing.T) {
	intents := []CategoryIntent{
		{CategoryID: "a", CategoryName: "a", Source: SourceStated, AmountMax: d(1_000_000)},
		{CategoryID: "b", CategoryName: "b", Source: SourceStated, AmountMax: d(1_000_000)},
	}
	res, err := Compute(PlanInput{Income: d(10_000_000), Intents: intents})
	if err != nil {
		t.Fatal(err)
	}
	if res.ScaledDown {
		t.Errorf("nothing needed reducing, but ScaledDown was set")
	}
}

// S-BWZ2-09 — the 50%-of-disposable ceiling does not apply when there is only
// one category. A single-category plan has nothing to be disproportionate to.
func TestComputeCeilingExemptForSingleCategory(t *testing.T) {
	res, err := Compute(PlanInput{
		Income:  d(10_000_000),
		Intents: []CategoryIntent{{CategoryID: "a", CategoryName: "a", Source: SourceStated, AmountMax: d(9_000_000)}},
	})
	if err != nil {
		t.Fatal(err)
	}
	half := res.Disposable / 2
	if res.Entries[0].AmountMax <= half {
		t.Errorf("single category was capped at %d, expected it to exceed half of disposable (%d)", res.Entries[0].AmountMax, half)
	}
}

// Every preset must sum to exactly 88%. A typo here silently changes the budget
// of every user who picks that profile, and nothing else would catch it.
func TestPresetSharesSumTo88(t *testing.T) {
	for _, p := range common.BudgetPresets {
		var total int64
		if len(p.Shares) > 6 {
			t.Errorf("%s has %d categories; the cap is 6", p.Key, len(p.Shares))
		}
		for _, s := range p.Shares {
			total += s.Percent
		}
		if total != common.BudgetWizardAllocatableNum {
			t.Errorf("%s sums to %d%%, want %d%%", p.Key, total, common.BudgetWizardAllocatableNum)
		}
	}
}

// The minimum-disposable constant has to be derived from the floor and the
// allocatable share, not picked. The spec's original 300.000đ was the floor sum
// with the 12% buffer forgotten, so the engine was forced to report ScaledDown
// at the exact figure the spec called sufficient.
func TestMinViableDisposableCoversSixCategories(t *testing.T) {
	floor := common.BudgetWizardMinAmountPerCategoryXu
	allocatable := common.MulDiv(common.BudgetWizardMinViableDisposableXu,
		common.BudgetWizardAllocatableNum, common.BudgetWizardAllocatableDen)
	if allocatable < floor*6 {
		t.Fatalf("min viable disposable %d leaves only %d allocatable, which cannot fund 6 x %d",
			common.BudgetWizardMinViableDisposableXu, allocatable, floor)
	}
}

// Source precedence: a stated amount beats a preset one for the same category,
// and the winner is taken whole rather than blended. Averaging the two would
// produce a number nobody chose and quietly discard an explicit instruction.
func TestResolveIntentsPrecedence(t *testing.T) {
	out := ResolveIntents([]CategoryIntent{
		{CategoryID: "a", Source: SourcePreset, AmountMax: d(380_000), Evidence: "preset"},
		{CategoryID: "a", Source: SourceStated, AmountMax: d(500_000), Evidence: "user"},
	})
	if len(out) != 1 {
		t.Fatalf("expected the duplicate to collapse, got %d entries", len(out))
	}
	if out[0].AmountMax != d(500_000) || out[0].Evidence != "user" {
		t.Errorf("stated source should win whole, got %+v", out[0])
	}
}

func TestMulDivDoesNotOverflow(t *testing.T) {
	// Near the income cap, a*num would overflow int64 outright.
	a := common.BudgetWizardIncomeCapXu
	got := common.MulDiv(a, a, a)
	if got != a {
		t.Fatalf("MulDiv(a, a, a) = %d, want %d", got, a)
	}
}
