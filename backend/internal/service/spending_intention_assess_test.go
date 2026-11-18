package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// S-INT-01: this month's plan against the Category's Budget and the surplus.
func TestIntentionAssess_BudgetAndSurplus(t *testing.T) {
	f := newIntentionFixture(t)
	f.shoppingBudget(2_000_000, 500_000)
	req := oneTime("Nước hoa", 2_000_000)
	req.CategoryID = &f.shopping.ID
	a := mustCreate(t, f, req).Assessment

	if a.Budget == nil || a.Budget.Remaining != vnd(1_500_000) || a.Budget.CategoryName != "Mua sắm" {
		t.Fatalf("the Budget must read exactly as the Budgets screen, got %+v", a.Budget)
	}
	if a.FitsBudget == nil || *a.FitsBudget || a.ShortBudget == nil || *a.ShortBudget != vnd(500_000) {
		t.Fatalf("2.000.000đ against 1.500.000đ left is short by 500.000đ, got %+v", a)
	}
	if a.Surplus == nil || *a.Surplus != vnd(3_000_000) || a.FitsSurplus == nil || !*a.FitsSurplus {
		t.Fatalf("surplus 3.000.000đ fits 2.000.000đ, got %+v", a)
	}
	if a.AssessedMonth != "2026-10" || a.BaselineCycles != 3 {
		t.Fatalf("assessed month / baseline = %s / %d", a.AssessedMonth, a.BaselineCycles)
	}
}

// S-INT-02: a later month is weighed against what the Category usually spends.
func TestIntentionAssess_FutureMonthUsesUsualSpending(t *testing.T) {
	f := newIntentionFixture(t)
	f.shoppingBudget(2_000_000, 500_000)
	f.usualCategorySpend(f.shopping.ID, 1_200_000)
	req := oneTime("Nước hoa", 2_000_000)
	req.CategoryID, req.TargetMonth = &f.shopping.ID, "2026-11"
	a := mustCreate(t, f, req).Assessment
	if a.Budget == nil || a.Budget.Basis != "usual" || a.Budget.Spent != vnd(1_200_000) || a.Budget.Remaining != vnd(800_000) {
		t.Fatalf("a later month reads the usual spending, not this cycle's 500.000đ, got %+v", a.Budget)
	}
	if a.Budget.Left == nil || *a.Budget.Left != vnd(800_000) || a.FitsBudget == nil || *a.FitsBudget || *a.ShortBudget != vnd(1_200_000) {
		t.Fatalf("2.000.000đ against 800.000đ of room is short by 1.200.000đ, got %+v", a)
	}
	if a.FitsSurplus == nil || !*a.FitsSurplus || a.AssessedMonth != "2026-11" {
		t.Fatalf("expected a surplus verdict for 2026-11, got %+v", a)
	}
}

// With no history a later month shows the limit only and no verdict.
func TestIntentionAssess_FutureMonthWithoutHistoryShowsTheLimitOnly(t *testing.T) {
	f := newIntentionFixture(t)
	f.reports.totals = nil
	f.shoppingBudget(2_000_000, 0)
	req := oneTime("Nước hoa", 2_000_000)
	req.CategoryID, req.TargetMonth = &f.shopping.ID, "2026-12"
	a := mustCreate(t, f, req).Assessment
	if a.Budget == nil || a.Budget.Basis != "limit" || a.Budget.Left != nil || a.FitsBudget != nil {
		t.Fatalf("no history means no verdict on the Budget, got %+v", a.Budget)
	}
}

// Two plans in one Category share its Budget (the point of weighing them together).
func TestIntentionAssess_SameCategoryPlansShareOneBudget(t *testing.T) {
	f := newIntentionFixture(t)
	f.shoppingBudget(2_000_000, 500_000) // 1.500.000đ left
	for _, plan := range []struct {
		title string
		price int64
	}{{"Nước hoa", 1_000_000}, {"Giày", 800_000}} {
		req := oneTime(plan.title, plan.price)
		req.CategoryID = &f.shopping.ID
		mustCreate(t, f, req)
	}
	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, item := range list.Items {
		a := item.Assessment
		other := map[string]int64{"Nước hoa": 800_000, "Giày": 1_000_000}[item.Title]
		if a.Budget == nil || a.Budget.OtherPlanned != vnd(other) {
			t.Fatalf("%s must see the other plan in its Category (%d), got %+v", item.Title, vnd(other), a.Budget)
		}
	}
	// Alone each fits 1.500.000đ; with the other counted, the perfume (1.000.000đ) has 700.000đ left.
	if a := list.Items[0].Assessment; a.FitsBudget == nil || *a.FitsBudget || *a.ShortBudget != vnd(300_000) {
		t.Fatalf("the perfume is short by 300.000đ once the shoes are counted, got %+v", a)
	}
}

// The portfolio: every plan together, month by month, against the surplus and each Budget.
func TestIntentionPortfolio_MonthByMonth(t *testing.T) {
	f := newIntentionFixture(t) // surplus 3.000.000đ
	f.shoppingBudget(2_000_000, 500_000)
	f.usualCategorySpend(f.shopping.ID, 1_000_000)
	perfume := oneTime("Nước hoa", 1_000_000)
	perfume.CategoryID = &f.shopping.ID
	mustCreate(t, f, perfume)
	shoes := oneTime("Giày", 800_000)
	shoes.CategoryID, shoes.TargetMonth = &f.shopping.ID, "2026-11"
	mustCreate(t, f, shoes)
	mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Niềng răng", Kind: common.IntentionKindInstallment, MonthlyAmount: ptr(vnd(2_500_000)), InstallmentMonths: ptr(3),
	}})

	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list.Portfolios) != 1 {
		t.Fatalf("one currency, one portfolio, got %+v", list.Portfolios)
	}
	p := list.Portfolios[0]
	if p.Count != 3 || p.Surplus == nil || *p.Surplus != vnd(3_000_000) {
		t.Fatalf("count / surplus wrong: %+v", p)
	}
	if len(p.Months) != 3 {
		t.Fatalf("the instalment runs three months, got %+v", p.Months)
	}
	oct, nov, dec := p.Months[0], p.Months[1], p.Months[2]
	if oct.Month != "2026-10" || oct.Planned != vnd(3_500_000) || *oct.FitsSurplus || *oct.ShortSurplus != vnd(500_000) {
		t.Fatalf("October plans 3.500.000đ against 3.000.000đ: short by 500.000đ, got %+v", oct)
	}
	if nov.Planned != vnd(3_300_000) || *nov.ShortSurplus != vnd(300_000) || dec.Planned != vnd(2_500_000) || !*dec.FitsSurplus {
		t.Fatalf("November 3.300.000đ (short 300.000đ), December 2.500.000đ fits: got %+v / %+v", nov, dec)
	}
	if *dec.Headroom != vnd(500_000) {
		t.Fatalf("headroom rounds down onto its step, got %d", *dec.Headroom)
	}
	// Budgets: this cycle reads real spending (1.500.000đ left, 1.000.000đ planned → 500.000đ left);
	// November reads the usual spending (2.000.000đ − 1.000.000đ − 800.000đ = 200.000đ left).
	if len(oct.Budgets) != 1 || oct.Budgets[0].Basis != "this_cycle" || *oct.Budgets[0].Left != vnd(500_000) || !*oct.Budgets[0].Fits {
		t.Fatalf("October Budget wrong: %+v", oct.Budgets)
	}
	if len(nov.Budgets) != 1 || nov.Budgets[0].Basis != "usual" || *nov.Budgets[0].Left != vnd(200_000) || !*nov.Budgets[0].Fits {
		t.Fatalf("November Budget wrong: %+v", nov.Budgets)
	}
	if len(dec.Budgets) != 0 {
		t.Fatalf("December plans nothing in a Category with a Budget, got %+v", dec.Budgets)
	}
}

// A deleted plan leaves the portfolio, and a User with none has no portfolio.
func TestIntentionPortfolio_DeletedLeavesAndEmptyHasNone(t *testing.T) {
	f := newIntentionFixture(t)
	empty, err := f.svc.List(context.Background(), f.userID)
	if err != nil || len(empty.Portfolios) != 0 || len(empty.Items) != 0 {
		t.Fatalf("no intentions, no portfolio: %+v %v", empty, err)
	}
	gone := mustCreate(t, f, oneTime("Một", 500_000))
	mustCreate(t, f, oneTime("Hai", 300_000))
	if err := f.svc.Delete(context.Background(), f.userID, *gone.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	list, _ := f.svc.List(context.Background(), f.userID)
	if p := list.Portfolios[0]; p.Count != 1 || p.Months[0].Planned != vnd(300_000) {
		t.Fatalf("a deleted plan must leave the portfolio, got %+v", p)
	}
}

// S-INT-03: an instalment's burden is its monthly payment.
func TestIntentionAssess_InstalmentBurden(t *testing.T) {
	f := newIntentionFixture(t)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{
			{Type: "income", Currency: "VND", Amount: vnd(10_000_000)},
			{Type: "expense", Currency: "VND", Amount: vnd(9_000_000)},
		}
	}
	a := mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Niềng răng", Kind: common.IntentionKindInstallment, MonthlyAmount: ptr(vnd(1_500_000)), InstallmentMonths: ptr(12),
	}}).Assessment
	if a.Months != 12 || a.MonthlyBurden == nil || *a.MonthlyBurden != vnd(1_500_000) || a.Total == nil || *a.Total != vnd(18_000_000) {
		t.Fatalf("burden / total wrong: %+v", a)
	}
	if a.FitsSurplus == nil || *a.FitsSurplus || a.ShortSurplus == nil || *a.ShortSurplus != vnd(500_000) {
		t.Fatalf("1.500.000đ against a 1.000.000đ surplus is short by 500.000đ, got %+v", a)
	}
}

// S-INT-07: what other kept intentions take in the month comes off the surplus.
func TestIntentionAssess_OtherIntentionsOfTheMonth(t *testing.T) {
	f := newIntentionFixture(t)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{
			{Type: "income", Currency: "VND", Amount: vnd(12_000_000)},
			{Type: "expense", Currency: "VND", Amount: vnd(10_000_000)},
		}
	}
	mustCreate(t, f, oneTime("Đã giữ", 800_000))
	a := mustCreate(t, f, oneTime("Giày", 1_500_000)).Assessment
	if a.OtherPlanned != vnd(800_000) {
		t.Fatalf("other planned = %d, want 800.000đ", a.OtherPlanned)
	}
	if a.Headroom == nil || *a.Headroom != vnd(1_200_000) {
		t.Fatalf("headroom = %v, want 1.200.000đ", a.Headroom)
	}
	if *a.FitsSurplus || *a.ShortSurplus != vnd(300_000) {
		t.Fatalf("short by 300.000đ expected, got %+v", a)
	}
}

// An instalment counts in every month of its run, a one-time purchase in its own only.
func TestIntentionAssess_OtherPlannedByMonth(t *testing.T) {
	f := newIntentionFixture(t)
	mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Trả góp", Kind: common.IntentionKindInstallment, MonthlyAmount: ptr(vnd(500_000)), InstallmentMonths: ptr(3), TargetMonth: "2026-11",
	}})
	// One probe per month, each one-time purchase of its own month only.
	for _, month := range []string{"2026-10", "2026-11", "2026-12", "2027-01", "2027-02"} {
		probe := oneTime("Thử "+month, 100_000)
		probe.TargetMonth = month
		mustCreate(t, f, probe)
	}
	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	// What the instalment (Nov, Dec, Jan) takes, as each probe's month sees it;
	// the other probes sit in other months and never count.
	want := map[string]int64{"Thử 2026-10": 0, "Thử 2026-11": vnd(500_000), "Thử 2026-12": vnd(500_000), "Thử 2027-01": vnd(500_000), "Thử 2027-02": 0}
	for _, item := range list.Items {
		if expected, ok := want[item.Title]; ok && item.Assessment.OtherPlanned != expected {
			t.Fatalf("%s: other planned = %d, want %d", item.Title, item.Assessment.OtherPlanned, expected)
		}
	}
	// And the instalment sees the probe of its own first month, not the later ones.
	for _, item := range list.Items {
		if item.Title == "Trả góp" && item.Assessment.OtherPlanned != vnd(100_000) {
			t.Fatalf("the instalment's first month holds one 100.000đ probe, got %d", item.Assessment.OtherPlanned)
		}
	}
}

// S-INT-08: no completed cycle with activity means no surplus line.
func TestIntentionAssess_NoHistory(t *testing.T) {
	f := newIntentionFixture(t)
	f.reports.totals = nil
	a := mustCreate(t, f, oneTime("Giày", 1_500_000)).Assessment
	if a.BaselineCycles != 0 || a.Surplus != nil || a.Headroom != nil || a.FitsSurplus != nil || a.AvgIncome != nil {
		t.Fatalf("with no history every surplus figure must be absent, got %+v", a)
	}
	if a.MonthlyBurden == nil || *a.MonthlyBurden != vnd(1_500_000) {
		t.Fatalf("the burden is still the User's own figure, got %v", a.MonthlyBurden)
	}
}

// S-INT-29: a deleted intention stops counting in the others at once.
func TestIntentionAssess_DeleteStopsCounting(t *testing.T) {
	f := newIntentionFixture(t)
	gone := mustCreate(t, f, oneTime("Sẽ xóa", 800_000))
	mustCreate(t, f, oneTime("Giữ lại", 100_000))
	before, _ := f.svc.List(context.Background(), f.userID)
	if before.Items[1].Assessment.OtherPlanned != vnd(800_000) {
		t.Fatalf("expected 800.000đ planned by the other, got %d", before.Items[1].Assessment.OtherPlanned)
	}
	if err := f.svc.Delete(context.Background(), f.userID, *gone.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	after, _ := f.svc.List(context.Background(), f.userID)
	if len(after.Items) != 1 || after.Items[0].Assessment.OtherPlanned != 0 {
		t.Fatalf("the deleted one must not count, got %+v", after.Items)
	}
}

// EC-13: a plan whose month has passed is assessed against the current cycle.
func TestIntentionAssess_OverdueIsAssessedNow(t *testing.T) {
	f := newIntentionFixture(t)
	past := f.shopping.ID
	f.repo.rows = append(f.repo.rows, &model.SpendingIntention{
		ID: uuid.New(), UserID: f.userID, Title: "Quá hạn", Kind: common.IntentionKindOneTime, CategoryID: &past, Currency: "VND",
		TotalAmount: ptr(vnd(900_000)), TargetMonth: monthStart(analyticsNow.AddDate(0, -2, 0)),
	})
	f.shoppingBudget(2_000_000, 500_000)
	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	a := list.Items[0].Assessment
	if a.AssessedMonth != "2026-10" || a.Budget == nil || a.FitsBudget == nil || !*a.FitsBudget {
		t.Fatalf("an overdue plan is weighed against this cycle's Budget, got %+v", a)
	}
}

// Rounding (spec.md A-07): the surplus rounds down onto the step, never up.
func TestIntentionAssess_SurplusRoundsDown(t *testing.T) {
	f := newIntentionFixture(t)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{
			{Type: "income", Currency: "VND", Amount: vnd(12_345_678)},
			{Type: "expense", Currency: "VND", Amount: vnd(9_876_543)},
		}
	}
	a := mustCreate(t, f, oneTime("Giày", 100_000)).Assessment
	// 12.345.678 → 12.300.000 and 9.876.543 → 9.900.000 on the 100.000đ step;
	// the difference 2.400.000đ is already on it.
	if a.AvgIncome == nil || *a.AvgIncome != vnd(12_300_000) || *a.AvgExpense != vnd(9_900_000) {
		t.Fatalf("averages = %v / %v", a.AvgIncome, a.AvgExpense)
	}
	if *a.Surplus != vnd(2_400_000) || *a.Surplus%common.SuggestedStepLargeXu != 0 {
		t.Fatalf("surplus = %d, want 2.400.000đ on its step", *a.Surplus)
	}
}
