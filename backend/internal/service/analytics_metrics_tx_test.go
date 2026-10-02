package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func seedExpenses(n int) []model.AnalyticsExpense {
	out := make([]model.AnalyticsExpense, n)
	for i := range out {
		out[i] = model.AnalyticsExpense{
			ID: uuid.New(), Amount: int64(n-i) * 1_000_00, OccurredAt: analyticsNow.Add(-time.Duration(i) * time.Hour),
			CategoryName: "Ăn uống", WalletName: "Tiền mặt",
		}
	}
	return out
}

// The answer is still the first `limit` rows; the rest (up to the expand cap)
// ride along as more_rows, in the same order, so "và N khoản khác" can open
// in place instead of being a dead end.
func TestAnalytics_TopN_CarriesMoreRowsForExpand(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.analytics.expenses = seedExpenses(12)
	f.analytics.count = 12

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "top_n", Period: "this_cycle", Limit: 3})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(answer.Chart.Rows) != 3 || len(answer.Chart.MoreRows) != 9 {
		t.Fatalf("rows=%d more_rows=%d, want 3 and 9", len(answer.Chart.Rows), len(answer.Chart.MoreRows))
	}
	if answer.Chart.MoreRows[0].ID != f.analytics.expenses[3].ID {
		t.Fatalf("more_rows must continue rows in rank order")
	}
	if f.analytics.lastLimit != common.AnalyticsListExpandMaxRows {
		t.Fatalf("fetched %d rows, want the expand cap %d", f.analytics.lastLimit, common.AnalyticsListExpandMaxRows)
	}
}

// Q14 still answers with exactly one row — the expandable rest is extra.
func TestAnalytics_MaxTx_OneRowPlusMore(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.analytics.expenses = seedExpenses(4)
	f.analytics.count = 4

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "max_tx", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(answer.Chart.Rows) != 1 || len(answer.Chart.MoreRows) != 3 {
		t.Fatalf("rows=%d more_rows=%d, want 1 and 3", len(answer.Chart.Rows), len(answer.Chart.MoreRows))
	}
}

// Nothing beyond the limit → no more_rows at all (omitted from the JSON).
func TestAnalytics_TopN_NoMoreRowsWhenAllShown(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.analytics.expenses = seedExpenses(2)
	f.analytics.count = 2

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "top_n", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(answer.Chart.Rows) != 2 || answer.Chart.MoreRows != nil {
		t.Fatalf("rows=%d more_rows=%v, want 2 and nil", len(answer.Chart.Rows), answer.Chart.MoreRows)
	}
}
