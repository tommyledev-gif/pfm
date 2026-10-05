package service

import (
	"testing"
	"time"
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
