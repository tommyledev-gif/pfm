package service

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

var (
	detailFood   = uuid.MustParse("11111111-1111-4111-8111-111111111111")
	detailTravel = uuid.MustParse("22222222-2222-4222-8222-222222222222")
)

// todaySum is "tiêu hôm nay" as the AI Service reads it.
func todaySum() dto.AnalyticsQueryRequest {
	return dto.AnalyticsQueryRequest{Metric: "sum", Period: "custom", From: "2026-10-14", To: "2026-10-14"}
}

func stageTwoCategories(f *analyticsFixture) {
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: 250_000_00}}
	}
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry {
		return []model.ReportCategoryEntry{
			{CategoryID: detailFood, CategoryName: "Ăn uống", Type: "expense", Currency: "VND", Amount: 150_000_00},
			{CategoryID: detailTravel, CategoryName: "Di chuyển", Type: "expense", Currency: "VND", Amount: 100_000_00},
		}
	}
}

func hasFollowUp(answer *dto.AnalyticsAnswerResponse, metric string) bool {
	for _, fu := range answer.FollowUps {
		if fu.Query.Metric == metric {
			return true
		}
	}
	return false
}

// "tiêu hôm nay" says what the money went on: the Categories behind the
// total, and — with only a few expenses — the expenses themselves.
func TestAnalytics_SumShowsCategoriesAndFewExpenses(t *testing.T) {
	f := newAnalyticsFixture(t)
	stageTwoCategories(f)
	f.analytics.count = 3
	f.analytics.expenses = seedExpenses(3)

	answer, err := f.svc.Answer(context.Background(), f.userID, todaySum())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Type != string(model.AnalyticsChartDonut) || len(answer.Chart.Items) != 2 || *answer.Chart.Value != 250_000_00 {
		t.Fatalf("expected a two-slice donut of 250000, got %+v", answer.Chart)
	}
	if !strings.Contains(answer.Summary, "Ăn uống cao nhất") {
		t.Fatalf("summary does not name the top Category: %q", answer.Summary)
	}
	if len(answer.Chart.Rows) != 3 || f.analytics.lastLimit != common.AnalyticsInlineRowsMax {
		t.Fatalf("expected the 3 expenses listed (fetched %d), got %d", f.analytics.lastLimit, len(answer.Chart.Rows))
	}
	// Both where it went and the expenses are on screen: neither is a chip.
	if hasFollowUp(answer, "breakdown") || hasFollowUp(answer, "top_n") {
		t.Fatalf("follow-ups repeat what the answer shows: %+v", answer.FollowUps)
	}
}

// Past the inline cap the expenses are one chip away instead.
func TestAnalytics_SumWithManyExpensesOffersTheList(t *testing.T) {
	f := newAnalyticsFixture(t)
	stageTwoCategories(f)
	f.analytics.count = common.AnalyticsInlineRowsMax + 1
	f.analytics.expenses = seedExpenses(common.AnalyticsInlineRowsMax + 1)

	answer, err := f.svc.Answer(context.Background(), f.userID, todaySum())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Rows != nil {
		t.Fatalf("expected no inline rows past the cap, got %d", len(answer.Chart.Rows))
	}
	if !hasFollowUp(answer, "top_n") {
		t.Fatalf("expected a largest-expenses follow-up, got %+v", answer.FollowUps)
	}
	for _, fu := range answer.FollowUps {
		if _, err := toAnalyticsQuery(fu.Query); err != nil {
			t.Fatalf("follow-up %q is not answerable: %v", fu.Label, err)
		}
	}
}

// One Category asked about: the split would only repeat the total.
func TestAnalytics_SumForOneCategoryStaysANumber(t *testing.T) {
	f := newAnalyticsFixture(t)
	food, err := f.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: f.userID, Name: "Ăn uống", Type: "expense"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry {
		return []model.ReportCategoryEntry{{CategoryID: food.ID, CategoryName: "Ăn uống", Type: "expense", Currency: "VND", Amount: 500}}
	}
	f.analytics.count = 1

	req := thisCycleSum()
	req.CategoryIDs = []uuid.UUID{food.ID}
	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Type != string(model.AnalyticsChartNumber) || strings.Contains(answer.Summary, "cao nhất") {
		t.Fatalf("expected a plain total, got %s / %q", answer.Chart.Type, answer.Summary)
	}
}

// Income names its one source and never lists rows (the list is expenses).
func TestAnalytics_IncomeSumNamesItsSourceWithoutRows(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{{Type: "income", Currency: "VND", Amount: 900_000}}
	}
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry {
		return []model.ReportCategoryEntry{{CategoryID: detailFood, CategoryName: "Lương", Type: "income", Currency: "VND", Amount: 900_000}}
	}
	f.analytics.count = 1
	f.analytics.expenses = seedExpenses(1)

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "sum", TxType: "income", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasSuffix(answer.Summary, "Tất cả từ Lương.") || answer.Chart.Rows != nil {
		t.Fatalf("got %q with %d rows", answer.Summary, len(answer.Chart.Rows))
	}
}

// "tiền đi đâu hôm nay" with two expenses lists both under the donut.
func TestAnalytics_BreakdownListsFewExpenses(t *testing.T) {
	f := newAnalyticsFixture(t)
	stageTwoCategories(f)
	f.analytics.count = 2
	f.analytics.expenses = seedExpenses(2)

	req := todaySum()
	req.Metric, req.GroupBy = "breakdown", "category"
	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Type != string(model.AnalyticsChartDonut) || len(answer.Chart.Rows) != 2 {
		t.Fatalf("expected a donut with 2 rows, got %s / %d", answer.Chart.Type, len(answer.Chart.Rows))
	}
	if hasFollowUp(answer, "top_n") {
		t.Fatalf("the expenses are listed already: %+v", answer.FollowUps)
	}
}
