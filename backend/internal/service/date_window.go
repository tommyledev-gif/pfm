package service

import (
	"fmt"
	"time"

	"github.com/example/pfm/backend/internal/common"
)

// Bounds of a date-range filter (GET /reports/summary, GET /transactions,
// GET /transactions/export).
//
// A plain "YYYY-MM-DD" names a whole calendar day in common.AppLocation —
// the user's day, not UTC's. `from` is that day's first instant and `to` its
// last, because the queries compare occurred_at <= to. Parsed as UTC
// midnight instead, a one-day range (from == to, Home's "Ngày" tab) matched
// nothing, every range dropped its last day, and every range started at 07:00
// Vietnam time.
//
// A full RFC3339 timestamp is an exact instant and is taken as is.

// parseRangeStart is the `from` bound: the first instant of a plain date.
func parseRangeStart(value string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t.UTC(), nil
	}
	day, err := time.ParseInLocation(common.DateOnlyLayout, value, common.AppLocation)
	if err != nil {
		return time.Time{}, fmt.Errorf("parseRangeStart: %w", err)
	}
	return day.UTC(), nil
}

// parseRangeEnd is the `to` bound: the last instant of a plain date.
func parseRangeEnd(value string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t.UTC(), nil
	}
	day, err := time.ParseInLocation(common.DateOnlyLayout, value, common.AppLocation)
	if err != nil {
		return time.Time{}, fmt.Errorf("parseRangeEnd: %w", err)
	}
	return endOfDay(day), nil
}

// endOfDay is the last instant (at timestamptz precision) of the AppLocation
// day that starts at `dayStart`.
func endOfDay(dayStart time.Time) time.Time {
	return dayStart.AddDate(0, 0, 1).Add(-reportBoundResolution).UTC()
}
