package service

import (
	"context"
	"errors"

	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

type analyticsFixture struct {
	svc        *AnalyticsService
	reports    *scriptedReportRepo
	analytics  *fakeAnalyticsRepo
	wallets    *fakeWalletRepo
	categories *fakeCategoryRepo
	budgetRepo *fakeBudgetRepo
	resolver   *CycleResolver
	userID     uuid.UUID
}

// analyticsNow is mid-cycle, so "this cycle" is October 2026 (partial).
var analyticsNow = time.Date(2026, time.October, 14, 10, 0, 0, 0, common.AppLocation)

func newAnalyticsFixture(t *testing.T) *analyticsFixture {
	t.Helper()
	f := &analyticsFixture{
		reports: &scriptedReportRepo{}, analytics: &fakeAnalyticsRepo{},
		wallets: newFakeWalletRepo(), categories: newFakeCategoryRepo(), budgetRepo: newFakeBudgetRepo(),
		userID: uuid.New(),
	}
	if _, err := f.wallets.CreateWallet(context.Background(), nil, repository.CreateWalletParams{
		UserID: f.userID, Name: "Tiền mặt", Type: "cash", Currency: "VND", IsDefault: true,
	}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	f.resolver = NewCycleResolver(&fakeCyclePlanRepo{})
	f.resolver.now = func() time.Time { return analyticsNow }
	budgets := NewBudgetService(f.budgetRepo, f.resolver, zap.NewNop())
	f.svc = NewAnalyticsService(f.reports, f.analytics, f.wallets, f.categories, budgets, f.resolver, zap.NewNop())
	return f
}

func thisCycleSum() dto.AnalyticsQueryRequest {
	return dto.AnalyticsQueryRequest{Metric: "sum", Period: "this_cycle"}
}

// S-AIQ-06 + S-AIQ-12: the total equals what the Reports endpoint returns
// for the same bounds, and other currencies are reported, not added.
func TestAnalytics_Sum_MatchesReportsAndFlagsOtherCurrencies(t *testing.T) {
	f := newAnalyticsFixture(t)
	rows := []model.ReportTypeAmount{
		{Type: "expense", Currency: "VND", Amount: 245_000_000},
		{Type: "expense", Currency: "USD", Amount: 1_000},
		{Type: "income", Currency: "VND", Amount: 900_000_000},
	}
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount { return rows }
	f.analytics.count = 12

	answer, err := f.svc.Answer(context.Background(), f.userID, thisCycleSum())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Value == nil || *answer.Chart.Value != 245_000_000 {
		t.Fatalf("value = %v, want 245000000", answer.Chart.Value)
	}
	if len(answer.Notices) != 1 || answer.Notices[0].Code != noticeCodeCur || !strings.Contains(answer.Notices[0].Message, "USD") {
		t.Fatalf("expected an other-currency notice naming USD, got %+v", answer.Notices)
	}

	// Plan F6: the half-open window reaches the inclusive report query as
	// end − 1µs.
	got := f.reports.filters[0]
	if !got.To.Equal(answer.Period.To.Add(-time.Microsecond)) || !got.From.Equal(answer.Period.From) {
		t.Fatalf("report filter [%v, %v] does not match period [%v, %v)", got.From, got.To, answer.Period.From, answer.Period.To)
	}

	reportRepo := newFakeReportRepo()
	reportRepo.seedTotals(rows...)
	reportSvc := NewReportService(reportRepo, f.wallets, f.categories, f.resolver, zap.NewNop())
	summary, err := reportSvc.GetSummary(context.Background(), f.userID, dto.ReportSummaryQuery{
		From: got.From.Format(time.RFC3339Nano), To: got.To.Format(time.RFC3339Nano),
	})
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	for _, total := range summary.Totals {
		if total.Currency == "VND" && total.TotalExpense != *answer.Chart.Value {
			t.Fatalf("analytics %d != reports %d", *answer.Chart.Value, total.TotalExpense)
		}
	}
}

// S-AIQ-07/S-AIQ-08: percentage change, and no percentage from a zero base.
func TestAnalytics_Compare(t *testing.T) {
	f := newAnalyticsFixture(t)
	current := ResolveCycleWindow(analyticsNow, 1, 0, common.AppLocation)
	prevAmount := int64(120_000_00)
	f.reports.totals = func(filter repository.ReportFilter) []model.ReportTypeAmount {
		if filter.From.Equal(current.Start) {
			return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: 150_000_00}}
		}
		return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: prevAmount}}
	}
	f.analytics.count = 3
	req := dto.AnalyticsQueryRequest{Metric: "compare", Period: "this_cycle"}

	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c := answer.Chart.Compare; c == nil || c.ChangePct == nil || *c.ChangePct != 25 {
		t.Fatalf("expected +25%%, got %+v", answer.Chart.Compare)
	}

	prevAmount = 0
	answer, err = f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Compare.ChangePct != nil {
		t.Fatalf("expected no percentage from a zero previous period")
	}
	if len(answer.Notices) != 1 || answer.Notices[0].Code != noticeCodePrev {
		t.Fatalf("expected no-previous-data notice, got %+v", answer.Notices)
	}
}

// S-AIQ-15: another User's Category or Wallet is 403, never an empty answer.
func TestAnalytics_RejectsOtherUsersReferences(t *testing.T) {
	f := newAnalyticsFixture(t)
	other := uuid.New()
	foreignCategory, err := f.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: other, Name: "Của người khác", Type: "expense"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	foreignWallet, err := f.wallets.CreateWallet(context.Background(), nil, repository.CreateWalletParams{UserID: other, Name: "Ví lạ", Type: "cash", Currency: "VND"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	req := thisCycleSum()
	req.CategoryIDs = []uuid.UUID{foreignCategory.ID}
	if _, err := f.svc.Answer(context.Background(), f.userID, req); !errors.Is(err, common.ErrCategoryAccessDenied) {
		t.Fatalf("expected category access denied, got %v", err)
	}
	req = thisCycleSum()
	req.WalletID = &foreignWallet.ID
	if _, err := f.svc.Answer(context.Background(), f.userID, req); !errors.Is(err, common.ErrWalletAccessDenied) {
		t.Fatalf("expected wallet access denied, got %v", err)
	}
}

// S-AIQ-16: every broken cross-field rule comes back together.
func TestAnalytics_ValidationCollectsAllProblems(t *testing.T) {
	f := newAnalyticsFixture(t)
	amount := int64(1)
	_, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{
		Metric: "series", Period: "this_cycle", AmountMin: &amount, From: "2026-10-01",
	})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
	if problems, ok := appErr.Details.([]analyticsRuleError); !ok || len(problems) != 3 {
		t.Fatalf("expected 3 problems (from, period, amount_min), got %+v", appErr.Details)
	}
}

// S-AIQ-13 / A-03: divide by days that had spending, rounded half-up.
func TestAnalytics_AvgDailyUsesDaysWithSpending(t *testing.T) {
	f := newAnalyticsFixture(t)
	day := func(d int) time.Time { return time.Date(2026, time.October, d, 0, 0, 0, 0, time.UTC) }
	f.analytics.byDay = []model.AnalyticsDayAmount{{Day: day(1), Amount: 100}, {Day: day(3), Amount: 0}, {Day: day(5), Amount: 200}}
	f.analytics.count = 2

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "avg_daily", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if *answer.Chart.Days != 2 || *answer.Chart.Value != 150 {
		t.Fatalf("days=%d value=%d, want 2 and 150", *answer.Chart.Days, *answer.Chart.Value)
	}
	if !strings.Contains(answer.Summary, "2 ngày có chi tiêu") {
		t.Fatalf("summary must state the day count: %q", answer.Summary)
	}
	if got := divRoundHalfUp(3, 2); got != 2 {
		t.Fatalf("half-up 1.5 = %d, want 2", got)
	}
}

// S-AIQ-09: remaining budget is BudgetService's own figure.
func TestAnalytics_BudgetStatusMatchesBudgetsScreen(t *testing.T) {
	f := newAnalyticsFixture(t)
	categoryID := uuid.New()
	seedActiveBudget(f.budgetRepo, f.userID, categoryID, "Ăn uống", "VND", 2_000_000_00)
	f.budgetRepo.seedSpend(categoryID, "VND", 500_000_00)

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "budget_status", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	listed, _ := NewBudgetService(f.budgetRepo, f.resolver, zap.NewNop()).ListBudgets(context.Background(), f.userID)
	got := answer.Chart.Budgets[0]
	if got.Remaining != listed[0].Limits[0].Remaining || got.Spent != listed[0].Limits[0].Spent {
		t.Fatalf("analytics %+v != budgets %+v", got, listed[0].Limits[0])
	}
}

// S-AIQ-14: no data → empty state, no chart, still a follow-up.
func TestAnalytics_EmptyPeriod(t *testing.T) {
	f := newAnalyticsFixture(t)
	answer, err := f.svc.Answer(context.Background(), f.userID, thisCycleSum())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Type != string(model.AnalyticsChartNone) || !strings.HasPrefix(answer.Summary, "Không có khoản chi") {
		t.Fatalf("expected empty state, got %q / %s", answer.Summary, answer.Chart.Type)
	}
	if len(answer.FollowUps) == 0 || answer.FollowUps[0].Query.Period != "last_cycle" {
		t.Fatalf("expected a last-cycle follow-up, got %+v", answer.FollowUps)
	}
}
