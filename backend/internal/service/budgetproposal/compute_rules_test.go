package budgetproposal

import (
	"testing"

	"github.com/example/pfm/backend/internal/common"
)

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
