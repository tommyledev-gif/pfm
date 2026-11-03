package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

func TestParseRangeBounds_PlainDateIsAppLocationDay(t *testing.T) {
	from, err := parseRangeStart("2026-11-03")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	to, err := parseRangeEnd("2026-11-03")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	wantFrom := time.Date(2026, time.November, 3, 0, 0, 0, 0, common.AppLocation)
	wantTo := time.Date(2026, time.November, 4, 0, 0, 0, 0, common.AppLocation).Add(-reportBoundResolution)
	if !from.Equal(wantFrom) || !to.Equal(wantTo) {
		t.Fatalf("expected [%v, %v], got [%v, %v]", wantFrom, wantTo, from, to)
	}

	// The cases that used to fall outside a one-day window: the morning before
	// 07:00 and the afternoon after it, local time.
	for _, at := range []time.Time{
		time.Date(2026, time.November, 3, 0, 30, 0, 0, common.AppLocation),
		time.Date(2026, time.November, 3, 15, 18, 0, 0, common.AppLocation),
		time.Date(2026, time.November, 3, 23, 59, 59, 0, common.AppLocation),
	} {
		if at.Before(from) || at.After(to) {
			t.Fatalf("%v should fall inside the 2026-11-03 window [%v, %v]", at, from, to)
		}
	}
	next := time.Date(2026, time.November, 4, 0, 0, 0, 0, common.AppLocation)
	if !next.After(to) {
		t.Fatalf("the next day's first instant %v must fall after the window end %v", next, to)
	}
}

func TestParseRangeBounds_TimestampIsTakenAsIs(t *testing.T) {
	const stamp = "2026-11-03T08:15:00+07:00"
	want := time.Date(2026, time.November, 3, 1, 15, 0, 0, time.UTC)
	from, err := parseRangeStart(stamp)
	if err != nil || !from.Equal(want) {
		t.Fatalf("parseRangeStart(%q) = %v, %v; want %v", stamp, from, err, want)
	}
	to, err := parseRangeEnd(stamp)
	if err != nil || !to.Equal(want) {
		t.Fatalf("parseRangeEnd(%q) = %v, %v; want %v", stamp, to, err, want)
	}
}

func TestParseRangeBounds_RejectsMalformed(t *testing.T) {
	for _, value := range []string{"not-a-date", "2026-02-31", "03/11/2026"} {
		if _, err := parseRangeStart(value); err == nil {
			t.Fatalf("parseRangeStart(%q): expected an error", value)
		}
		if _, err := parseRangeEnd(value); err == nil {
			t.Fatalf("parseRangeEnd(%q): expected an error", value)
		}
	}
}

// Home's "Ngày" tab sends from == to == today; it used to reach the
// repository as an empty [00:00Z, 00:00Z] window and show 0 đ spent.
func TestReportService_GetSummary_SingleDayCoversTheWholeLocalDay(t *testing.T) {
	svc, reportRepo, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{From: "2026-11-03", To: "2026-11-03"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	wantFrom := time.Date(2026, time.November, 3, 0, 0, 0, 0, common.AppLocation)
	wantTo := time.Date(2026, time.November, 4, 0, 0, 0, 0, common.AppLocation).Add(-reportBoundResolution)
	if !reportRepo.lastFilter.From.Equal(wantFrom) || !reportRepo.lastFilter.To.Equal(wantTo) {
		t.Fatalf("expected window [%v, %v], got [%v, %v]", wantFrom, wantTo, reportRepo.lastFilter.From, reportRepo.lastFilter.To)
	}
}

// A month range ends on its last day (date-range.ts monthRange): that day
// is inside the window, not cut off at its first instant.
func TestReportService_GetSummary_MonthIncludesItsLastDay(t *testing.T) {
	svc, reportRepo, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{From: "2026-10-01", To: "2026-10-31"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	lastEvening := time.Date(2026, time.October, 31, 20, 0, 0, 0, common.AppLocation)
	if lastEvening.After(reportRepo.lastFilter.To) {
		t.Fatalf("31/10 20:00 local should be inside the window ending %v", reportRepo.lastFilter.To)
	}
}

func TestParseExportRange_UsesAppLocationDays(t *testing.T) {
	from, to, err := parseExportRange(dto.ExportTransactionsQuery{From: "2026-10-31", To: "2026-10-31"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	wantFrom := time.Date(2026, time.October, 31, 0, 0, 0, 0, common.AppLocation)
	wantTo := time.Date(2026, time.November, 1, 0, 0, 0, 0, common.AppLocation).Add(-reportBoundResolution)
	if !from.Equal(wantFrom) || !to.Equal(wantTo) {
		t.Fatalf("expected [%v, %v], got [%v, %v]", wantFrom, wantTo, from, to)
	}
}
