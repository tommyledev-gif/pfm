package service

import (
	"context"

	"reflect"

	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// Breakdown keeps six slices plus "Other", and the total is unchanged.
func TestAnalytics_BreakdownCapsSlices(t *testing.T) {
	f := newAnalyticsFixture(t)
	var entries []model.ReportCategoryEntry
	var total int64
	for i := 0; i < 9; i++ {
		amount := int64(1000 - i*100)
		total += amount
		entries = append(entries, model.ReportCategoryEntry{CategoryID: uuid.New(), CategoryName: "C", Type: "expense", Currency: "VND", Amount: amount})
	}
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry { return entries }
	f.analytics.count = 9

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "breakdown", GroupBy: "category", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	items := answer.Chart.Items
	if len(items) != common.AnalyticsBreakdownMaxSlices+1 || items[len(items)-1].Key != common.AnalyticsOtherSliceKey {
		t.Fatalf("expected 6 slices + other, got %d", len(items))
	}
	var sum int64
	for _, it := range items {
		sum += it.Amount
	}
	if sum != total || *answer.Chart.Value != total {
		t.Fatalf("slices sum %d, value %d, want %d", sum, *answer.Chart.Value, total)
	}
}

// Series drops leading empty cycles and says how many there are.
func TestAnalytics_SeriesDropsLeadingEmptyCycles(t *testing.T) {
	f := newAnalyticsFixture(t)
	recent := ResolveCycleWindow(analyticsNow, 1, -1, common.AppLocation).Start
	f.reports.totals = func(filter repository.ReportFilter) []model.ReportTypeAmount {
		if filter.From.Before(recent) {
			return nil
		}
		return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: 100}}
	}
	f.analytics.count = 4

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "series", Period: "last_6_cycles"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(answer.Chart.Items) != 2 || answer.Notices[0].Code != noticeCodeFew {
		t.Fatalf("expected 2 cycles + fewer-cycles notice, got %d / %+v", len(answer.Chart.Items), answer.Notices)
	}
}

// Weekday bars are Monday-first; 2026-10-05 is a Monday.
func TestAnalytics_WeekdayIsMondayFirst(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.analytics.byDay = []model.AnalyticsDayAmount{{Day: time.Date(2026, time.October, 5, 0, 0, 0, 0, time.UTC), Amount: 700}}
	f.analytics.count = 1

	answer, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "breakdown", GroupBy: "weekday", Period: "this_cycle"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Items[0].Key != "mon" || answer.Chart.Items[0].Amount != 700 {
		t.Fatalf("expected Monday first with 700, got %+v", answer.Chart.Items[0])
	}
}

// US-04: follow-ups are complete questions that never repeat the asked one
// and are themselves answerable.
func TestAnalytics_FollowUpsAreValidAndNeverRepeat(t *testing.T) {
	f := newAnalyticsFixture(t)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: 100}}
	}
	f.analytics.count = 1
	req := thisCycleSum()

	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(answer.FollowUps) == 0 {
		t.Fatalf("expected follow-ups")
	}
	for _, fu := range answer.FollowUps {
		if reflect.DeepEqual(fu.Query, req) {
			t.Fatalf("follow-up repeats the question: %+v", fu)
		}
		if _, err := toAnalyticsQuery(fu.Query); err != nil {
			t.Fatalf("follow-up %q is not answerable: %v", fu.Label, err)
		}
	}
}
