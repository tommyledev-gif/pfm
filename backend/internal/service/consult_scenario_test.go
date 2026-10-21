package service

import (
	"testing"
	"time"

	"github.com/example/pfm/backend/internal/common"
)

func TestPlanScenarioDeadline(t *testing.T) {
	loc := time.UTC
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, loc)
	goal := int64(30_000_000)
	p := &AIConsultParse{GoalAmountVND: &goal, GoalDeadline: "2026-12-01"}
	base := scenarioBaseline{cycles: 3, income: 20_000_000_00, expense: 15_000_000_00, monthly: true}

	sc, msg := planScenario(p, base, today, loc, "VND")
	if sc == nil {
		t.Fatalf("no plan: %s", msg)
	}
	if sc.Months != 2 || sc.MonthlySave != 15_000_000_00 {
		t.Fatalf("months=%d save=%d", sc.Months, sc.MonthlySave)
	}
	if *sc.SpendCap != 5_000_000_00 || *sc.CutNeeded != 10_000_000_00 || *sc.Feasible {
		t.Fatalf("cap=%d cut=%d feasible=%v", *sc.SpendCap, *sc.CutNeeded, *sc.Feasible)
	}
	if got := summaryScenario(sc, true); got == "" {
		t.Fatal("empty summary")
	}
}

func TestPlanScenarioPastDeadline(t *testing.T) {
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	goal := int64(1_000_000)
	p := &AIConsultParse{GoalAmountVND: &goal, GoalDeadline: "2026-10-05"}
	if sc, _ := planScenario(p, scenarioBaseline{}, today, time.UTC, "VND"); sc != nil {
		t.Fatal("past deadline must not plan")
	}
}

func TestPlanScenarioFromSurplus(t *testing.T) {
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	goal := int64(25_000_000)
	base := scenarioBaseline{cycles: 2, income: 10_000_000_00, expense: 6_000_000_00}
	sc, _ := planScenario(&AIConsultParse{GoalAmountVND: &goal}, base, today, time.UTC, "VND")
	if sc == nil || sc.Months != 7 || !*sc.Feasible {
		t.Fatalf("got %+v", sc)
	}
}

// Every worked-out VND figure lands on its suggested step: 5.000đ under
// 1.000.000đ, 100.000đ from there (owner rule 2026-10-21), and the cap and
// cut are built from the rounded figures so they still add up.
func TestPlanScenarioRoundsToSuggestedSteps(t *testing.T) {
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	goal := int64(10_000_001)
	p := &AIConsultParse{GoalAmountVND: &goal, GoalDeadline: "2027-01-01"}
	base := scenarioBaseline{cycles: 3, income: 12_345_678_00, expense: 9_876_543_21, monthly: true}

	sc, msg := planScenario(p, base, today, time.UTC, "VND")
	if sc == nil {
		t.Fatalf("no plan: %s", msg)
	}
	// 10.000.001đ over 3 months is 3.333.334đ a month: UP to 3.400.000đ.
	want := map[string][2]int64{
		"save": {sc.MonthlySave, 3_400_000_00}, "income": {*sc.AvgIncome, 12_300_000_00},
		"expense": {*sc.AvgExpense, 9_900_000_00}, "cap": {*sc.SpendCap, 8_900_000_00}, "cut": {*sc.CutNeeded, 1_000_000_00},
	}
	for name, v := range want {
		if v[0] != v[1] {
			t.Errorf("%s = %d xu, want %d", name, v[0], v[1])
		}
		assertOnSuggestedStep(t, name, v[0])
	}
}

// A saving under 1.000.000đ keeps the 5.000đ step while the cap built from it
// is rounded DOWN onto the 100.000đ step: never more than the plan allows.
func TestPlanScenarioMixedSteps(t *testing.T) {
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	goal := int64(2_200_000)
	p := &AIConsultParse{GoalAmountVND: &goal, GoalDeadline: "2027-01-01"}
	base := scenarioBaseline{cycles: 3, income: 15_000_000_00, expense: 14_000_000_00, monthly: true}

	sc, msg := planScenario(p, base, today, time.UTC, "VND")
	if sc == nil {
		t.Fatalf("no plan: %s", msg)
	}
	if sc.MonthlySave != 735_000_00 || *sc.SpendCap != 14_200_000_00 || *sc.CutNeeded != 0 || !*sc.Feasible {
		t.Fatalf("save=%d cap=%d cut=%d feasible=%v", sc.MonthlySave, *sc.SpendCap, *sc.CutNeeded, *sc.Feasible)
	}
	if *sc.AvgIncome-*sc.SpendCap < sc.MonthlySave {
		t.Errorf("income %d - cap %d no longer covers the saving %d", *sc.AvgIncome, *sc.SpendCap, sc.MonthlySave)
	}

	// Spending above the cap: the cut is rounded UP and cap + cut covers it.
	base.expense = 15_000_000_00
	base.income = 15_500_000_00
	sc, _ = planScenario(p, base, today, time.UTC, "VND")
	if *sc.SpendCap != 14_700_000_00 || *sc.CutNeeded != 300_000_00 || *sc.Feasible {
		t.Fatalf("cap=%d cut=%d feasible=%v", *sc.SpendCap, *sc.CutNeeded, *sc.Feasible)
	}
}

func TestSuggestedStep(t *testing.T) {
	cases := []struct {
		xu       int64
		currency string
		want     int64
	}{
		{999_999_00, "VND", 5_000_00}, {1_000_000_00, "VND", 100_000_00}, {25_000_000_00, "VND", 100_000_00},
		{50_00, "VND", 5_000_00}, {1_000_000_00, "USD", 100},
	}
	for _, c := range cases {
		if got := common.SuggestedStep(c.xu, c.currency); got != c.want {
			t.Errorf("SuggestedStep(%d, %s) = %d, want %d", c.xu, c.currency, got, c.want)
		}
	}
	if got := roundNearest(998_000_00, "VND"); got != 1_000_000_00 {
		t.Errorf("998.000đ to nearest = %d", got)
	}
	if got := roundUp(1_000_000_01, "VND"); got != 1_100_000_00 {
		t.Errorf("1.000.000,01đ up = %d", got)
	}
	if got := roundDown(1_050_000_00, "VND"); got != 1_000_000_00 {
		t.Errorf("1.050.000đ down = %d", got)
	}
}

func assertOnSuggestedStep(t *testing.T, name string, xu int64) {
	t.Helper()
	if step := common.SuggestedStep(xu, "VND"); xu%step != 0 {
		t.Errorf("%s = %d xu, not a multiple of its %d xu step", name, xu, step)
	}
}

func TestMonthsUntil(t *testing.T) {
	today := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	cases := map[string]int{"2026-10-20": 1, "2026-11-03": 1, "2026-12-01": 2, "2026-12-31": 3, "2027-10-05": 12}
	for d, want := range cases {
		dl, _ := time.Parse("2006-01-02", d)
		if got := monthsUntil(today, dl); got != want {
			t.Errorf("%s: got %d want %d", d, got, want)
		}
	}
}
