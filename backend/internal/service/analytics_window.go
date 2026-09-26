package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// analyticsWindows is a question's resolved time scope: the whole span, the
// per-cycle parts for a series, and the preceding window for a comparison.
// Every bound comes from CycleResolver's clock and timezone (plan.md BR-03).
type analyticsWindows struct {
	whole model.AnalyticsWindow
	parts []model.AnalyticsWindow
	prev  *model.AnalyticsWindow
	// monthly is true when cycles coincide with calendar months, so labels
	// can say "tháng" instead of "kỳ".
	monthly bool
}

func (s *AnalyticsService) resolveWindows(ctx context.Context, userID uuid.UUID, q model.AnalyticsQuery) (analyticsWindows, error) {
	now := s.cycles.Now()
	loc := s.cycles.Location()

	// One plan read per question, however many cycles a series spans.
	day, err := s.cycles.plans.ActiveCycleStartDay(ctx, userID)
	if err != nil {
		return analyticsWindows{}, fmt.Errorf("service.resolveWindows: %w", err)
	}
	cycle := func(offset int) model.AnalyticsWindow {
		w := ResolveCycleWindow(now, day, offset, loc)
		return model.AnalyticsWindow{Start: w.Start, End: w.End, Partial: now.Before(w.End)}
	}
	out := analyticsWindows{monthly: cycle(0).Start.In(loc).Day() == budgetCycleMinDay}

	switch q.Period {
	case model.AnalyticsPeriodThisCycle, model.AnalyticsPeriodLastCycle:
		offset := 0
		if q.Period == model.AnalyticsPeriodLastCycle {
			offset = -1
		}
		p := cycle(offset - 1)
		out.whole, out.prev = cycle(offset), &p
	case model.AnalyticsPeriodLast3Cycles, model.AnalyticsPeriodLast6Cycles:
		n := analyticsSeriesLength(q.Period)
		for offset := -(n - 1); offset <= 0; offset++ {
			out.parts = append(out.parts, cycle(offset))
		}
		out.whole = model.AnalyticsWindow{Start: out.parts[0].Start, End: out.parts[n-1].End, Partial: true}
	case model.AnalyticsPeriodLast30Days:
		end := localMidnight(now, loc).AddDate(0, 0, 1)
		out.whole = spanWindow(end.AddDate(0, 0, -common.AnalyticsLastDaysWindow), end, now)
		p := spanWindow(end.AddDate(0, 0, -2*common.AnalyticsLastDaysWindow), end.AddDate(0, 0, -common.AnalyticsLastDaysWindow), now)
		out.prev = &p
	case model.AnalyticsPeriodThisWeek:
		start := startOfWeek(now, loc)
		out.whole = spanWindow(start, start.AddDate(0, 0, common.AnalyticsDaysPerWeek), now)
		p := spanWindow(start.AddDate(0, 0, -common.AnalyticsDaysPerWeek), start, now)
		out.prev = &p
	case model.AnalyticsPeriodCustom:
		out.whole = spanWindow(*q.From, q.To.AddDate(0, 0, 1), now)
	}
	return out, nil
}

func analyticsSeriesLength(p model.AnalyticsPeriod) int {
	if p == model.AnalyticsPeriodLast3Cycles {
		return common.AnalyticsSeriesShortCycles
	}
	return common.AnalyticsSeriesMaxCycles
}

// spanWindow converts local-midnight bounds to a UTC window.
func spanWindow(start, end, now time.Time) model.AnalyticsWindow {
	return model.AnalyticsWindow{Start: start.UTC(), End: end.UTC(), Partial: now.Before(end)}
}

func localMidnight(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
}

// startOfWeek is the local Monday — Vietnamese weeks start on Monday.
func startOfWeek(t time.Time, loc *time.Location) time.Time {
	day := localMidnight(t, loc)
	return day.AddDate(0, 0, -mondayIndex(day.Weekday()))
}

// windowDays is a window's length in whole local days.
func windowDays(w model.AnalyticsWindow, loc *time.Location) int {
	return CycleWindow{Start: w.Start, End: w.End}.Days(loc)
}
