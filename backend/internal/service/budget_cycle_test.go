package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

func localTime(y int, m time.Month, d, hh, mm int) time.Time {
	return time.Date(y, m, d, hh, mm, 0, 0, common.AppLocation)
}

func assertWindow(t *testing.T, got CycleWindow, wantStart, wantEnd time.Time) {
	t.Helper()
	if !got.Start.Equal(wantStart) || !got.End.Equal(wantEnd) {
		t.Fatalf("window = [%v, %v), want [%v, %v)", got.Start, got.End, wantStart.UTC(), wantEnd.UTC())
	}
}

// S-BWZ2-16: day 1 reproduces the calendar month, 31 days.
func TestResolveCycleWindow_DayOneIsCalendarMonth(t *testing.T) {
	w := ResolveCycleWindow(localTime(2026, time.October, 14, 12, 0), 1, 0, common.AppLocation)
	assertWindow(t, w, localTime(2026, time.October, 1, 0, 0), localTime(2026, time.November, 1, 0, 0))
	if got := w.Days(common.AppLocation); got != 31 {
		t.Fatalf("days = %d, want 31", got)
	}
}

// S-BWZ2-17: pay day 25, today the 3rd → cycle began the 25th of last month.
func TestResolveCycleWindow_BeforeCycleDayBelongsToPreviousMonth(t *testing.T) {
	w := ResolveCycleWindow(localTime(2026, time.October, 3, 9, 0), 25, 0, common.AppLocation)
	assertWindow(t, w, localTime(2026, time.September, 25, 0, 0), localTime(2026, time.October, 25, 0, 0))
}

// S-BWZ2-18: day 28 across February — no hardcoded month length.
func TestResolveCycleWindow_FebruaryLengths(t *testing.T) {
	cases := []struct {
		now  time.Time
		days int
	}{
		{localTime(2027, time.February, 10, 0, 0), 31}, // 28 Jan → 28 Feb
		{localTime(2027, time.March, 1, 0, 0), 28},     // 28 Feb → 28 Mar, non-leap
		{localTime(2028, time.March, 1, 0, 0), 29},     // 28 Feb → 28 Mar, leap year
	}
	for _, c := range cases {
		if got := ResolveCycleWindow(c.now, 28, 0, common.AppLocation).Days(common.AppLocation); got != c.days {
			t.Fatalf("now %v: days = %d, want %d", c.now, got, c.days)
		}
	}
}

// S-BWZ2-20: no plan (day 0) and out-of-range values fall back to day 1.
func TestResolveCycleWindow_NoPlanFallsBackToCalendarMonth(t *testing.T) {
	now := localTime(2026, time.October, 14, 0, 0)
	want := ResolveCycleWindow(now, 1, 0, common.AppLocation)
	for _, day := range []int{0, -3, 29, 31} {
		if got := ResolveCycleWindow(now, day, 0, common.AppLocation); got != want {
			t.Fatalf("day %d: got %v, want %v", day, got, want)
		}
	}
}

// S-AIQ-11: 00:30 local on the 1st is still 17:30 UTC on the last day of the
// previous month — it must land in the NEW cycle.
func TestResolveCycleWindow_LocalMidnightBoundary(t *testing.T) {
	now := localTime(2026, time.October, 1, 0, 30)
	w := ResolveCycleWindow(now, 1, 0, common.AppLocation)
	if now.Before(w.Start) || !now.Before(w.End) {
		t.Fatalf("%v not in [%v, %v)", now, w.Start, w.End)
	}
	if w.Start.Hour() != 17 || w.Start.Day() != 30 {
		t.Fatalf("start = %v, want 2026-09-30T17:00Z", w.Start)
	}
}

// Offsets walk whole cycles, including across a year boundary.
func TestResolveCycleWindow_Offsets(t *testing.T) {
	now := localTime(2026, time.January, 20, 0, 0)
	prev := ResolveCycleWindow(now, 5, -1, common.AppLocation)
	assertWindow(t, prev, localTime(2025, time.December, 5, 0, 0), localTime(2026, time.January, 5, 0, 0))
	back := ResolveCycleWindow(now, 5, -5, common.AppLocation)
	assertWindow(t, back, localTime(2025, time.August, 5, 0, 0), localTime(2025, time.September, 5, 0, 0))
}

func TestCycleWindow_StartDateIsLocalDay(t *testing.T) {
	w := ResolveCycleWindow(localTime(2026, time.October, 14, 0, 0), 1, 0, common.AppLocation)
	want := time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC)
	if got := w.StartDate(common.AppLocation); !got.Equal(want) {
		t.Fatalf("start date = %v, want %v", got, want)
	}
}

// Budget spend is read over the caller's resolved cycle, not a fixed month.
func TestBudgetService_ListBudgets_ReadsCallerCycle(t *testing.T) {
	userID := uuid.New()
	repo := newFakeBudgetRepo()
	resolver := NewCycleResolver(&fakeCyclePlanRepo{byUser: map[uuid.UUID]int{userID: 25}})
	fixedNow := localTime(2026, time.October, 3, 10, 0)
	resolver.now = func() time.Time { return fixedNow }
	svc := NewBudgetService(repo, resolver, zap.NewNop())

	if _, err := svc.ListBudgets(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertWindow(t, repo.lastWindow, localTime(2026, time.September, 25, 0, 0), localTime(2026, time.October, 25, 0, 0))
}

// I-4: the replace transaction always takes the per-User lock first, even
// for a User with no Budgets to lock.
func TestBudgetService_BulkReplace_LocksUserRow(t *testing.T) {
	svc, repo := newTestBudgetService(t)
	userID := uuid.New()
	category := seedExpenseCategory(repo, userID)

	_, err := svc.BulkReplaceBudgets(context.Background(), userID, []dto.BulkBudgetItem{
		{CategoryID: category.ID, Period: common.BudgetPeriodMonthly, Limits: []dto.BulkLimitItem{{Currency: "VND", AmountLimit: 5_000_000}}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.userLocks != 1 {
		t.Fatalf("user lock taken %d times, want 1", repo.userLocks)
	}
}
