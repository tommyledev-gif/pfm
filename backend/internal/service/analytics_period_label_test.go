package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// analyticsNow's own local day, as the free-text path would send it.
const analyticsToday = "2026-10-14"

func oneDaySum(day string) dto.AnalyticsQueryRequest {
	return dto.AnalyticsQueryRequest{Metric: "sum", Period: "custom", From: day, To: day}
}

// S-AIQ-49: today is one local day, half-open in the app timezone — so a
// Transaction at 00:30 counts and one at 23:50 the day before does not — and
// it is labelled as today, "up to now".
func TestAnalytics_SingleDayToday_WindowAndWording(t *testing.T) {
	f := newAnalyticsFixture(t)
	var got repository.ReportFilter
	f.reports.totals = func(filter repository.ReportFilter) []model.ReportTypeAmount {
		got = filter
		return []model.ReportTypeAmount{{Type: "expense", Currency: "VND", Amount: 8_500_000}}
	}
	f.analytics.count = 2

	answer, err := f.svc.Answer(context.Background(), f.userID, oneDaySum(analyticsToday))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	start := time.Date(2026, time.October, 14, 0, 0, 0, 0, common.AppLocation)
	if !got.From.Equal(start) || !got.To.Equal(start.AddDate(0, 0, 1).Add(-reportBoundResolution)) {
		t.Fatalf("window = [%v, %v], want the local day %v", got.From, got.To, start)
	}
	if answer.Period.Label != "hôm nay (14/10)" || !answer.Period.Partial {
		t.Fatalf("period = %+v, want today's label, partial", answer.Period)
	}
	if !strings.HasPrefix(answer.Summary, soFarTodayPrefix+"hôm nay (14/10)") {
		t.Fatalf("summary = %q, want the up-to-now lead", answer.Summary)
	}
}

// A past single day reads as that day, never "từ 13/10 đến 13/10", and its
// empty state is "vào ngày …", never "trong từ …".
func TestAnalytics_SingleDayPast_Wording(t *testing.T) {
	f := newAnalyticsFixture(t)
	answer, err := f.svc.Answer(context.Background(), f.userID, oneDaySum("2026-10-13"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Period.Label != "ngày 13/10" || answer.Period.Partial {
		t.Fatalf("period = %+v, want a closed single day", answer.Period)
	}
	if answer.Summary != "Không có khoản chi nào vào ngày 13/10." {
		t.Fatalf("summary = %q", answer.Summary)
	}
}

// A multi-day range keeps its range label; its empty state drops the
// doubled preposition ("trong từ …") it used to have.
func TestAnalytics_MultiDayRange_WordingUnchanged(t *testing.T) {
	f := newAnalyticsFixture(t)
	req := dto.AnalyticsQueryRequest{Metric: "sum", Period: "custom", From: "2026-09-01", To: "2026-09-15"}
	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Period.Label != "từ 01/09 đến 15/09" || answer.Summary != "Không có khoản chi nào từ 01/09 đến 15/09." {
		t.Fatalf("label %q / summary %q", answer.Period.Label, answer.Summary)
	}
}

// R-F22 (a): a well-shaped date that does not exist is a validation error on
// both paths, never a zero time.
func TestAnalytics_NonexistentDateIsInvalid(t *testing.T) {
	f := newAnalyticsFixture(t)
	_, err := f.svc.Answer(context.Background(), f.userID, oneDaySum("2026-02-31"))
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}
