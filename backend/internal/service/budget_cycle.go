package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
)

// budgetCycleMinDay/MaxDay bound cycle_start_day (DB CHECK in
// 020_budget_plans.sql). Days 29–31 are rejected at write time, never clamped
// (specs/ai-budget-wizard-v2/spec.md US-03 Edge Case #1); a value outside the
// range reaching this resolver can only mean "no plan", so it reads as day 1.
const (
	budgetCycleMinDay = 1
	budgetCycleMaxDay = 28
	hoursPerDay       = 24
)

// CycleWindow is one spending cycle as a half-open [Start, End) interval,
// both bounds in UTC. Every spend figure (budgets, notifications, reports'
// default window, analytics) reads through this one shape so two screens can
// never disagree about which days "this month" covers.
type CycleWindow struct {
	Start time.Time
	End   time.Time
}

// ResolveCycleWindow returns the cycle containing now, shifted by offset
// cycles (0 = current, -1 = previous). Boundaries are local midnights in loc
// on day cycleStartDay; a cycleStartDay of 1 reproduces the calendar month
// exactly (S-BWZ2-16/S-BWZ2-20). Month arithmetic goes through time.Date's
// normalization, so short months need no special case (S-BWZ2-18).
func ResolveCycleWindow(now time.Time, cycleStartDay, offset int, loc *time.Location) CycleWindow {
	day := cycleStartDay
	if day < budgetCycleMinDay || day > budgetCycleMaxDay {
		day = budgetCycleMinDay
	}

	local := now.In(loc)
	month := local.Month()
	if local.Day() < day {
		month--
	}
	month += time.Month(offset)

	start := time.Date(local.Year(), month, day, 0, 0, 0, 0, loc)
	end := time.Date(local.Year(), month+1, day, 0, 0, 0, 0, loc)
	return CycleWindow{Start: start.UTC(), End: end.UTC()}
}

// Days is the cycle length in whole local days — from the real dates, never a
// hardcoded 30 (spec.md US-03 Main Flow step 5).
func (w CycleWindow) Days(loc *time.Location) int {
	return int(localDate(w.End, loc).Sub(localDate(w.Start, loc)).Hours() / hoursPerDay)
}

// StartDate is the cycle's first local calendar day as a UTC-midnight value —
// the shape DATE columns (e.g. notifications.period_start) expect, so the
// stored date is the local day regardless of the UTC instant behind it.
func (w CycleWindow) StartDate(loc *time.Location) time.Time {
	return localDate(w.Start, loc)
}

// CycleResolver looks up the caller's cycle start day and resolves windows
// against the app clock and timezone. The clock is a field so tests can pin
// "now" without sleeping or mocking globals.
type CycleResolver struct {
	plans CyclePlanRepo
	loc   *time.Location
	now   func() time.Time
}

func NewCycleResolver(plans CyclePlanRepo) *CycleResolver {
	return &CycleResolver{plans: plans, loc: common.AppLocation, now: time.Now}
}

// Current is the caller's cycle containing now.
func (r *CycleResolver) Current(ctx context.Context, userID uuid.UUID) (CycleWindow, error) {
	return r.Window(ctx, userID, 0)
}

// Window is the caller's cycle offset cycles away from the current one. A
// User without an active plan has cycle day 0 → the calendar month.
func (r *CycleResolver) Window(ctx context.Context, userID uuid.UUID, offset int) (CycleWindow, error) {
	day, err := r.plans.ActiveCycleStartDay(ctx, userID)
	if err != nil {
		return CycleWindow{}, fmt.Errorf("service.CycleResolver.Window: %w", err)
	}
	return ResolveCycleWindow(r.now(), day, offset, r.loc), nil
}

// Now is the resolver's clock — analytics windows that are not cycles (last
// 30 days, this week) must use the same "now" as the cycles beside them.
func (r *CycleResolver) Now() time.Time {
	return r.now()
}

// Location is the timezone every window from this resolver is computed in.
func (r *CycleResolver) Location() *time.Location {
	return r.loc
}

func localDate(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}
