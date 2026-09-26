package service

import (
	"context"

	"github.com/google/uuid"
)

// fakeCyclePlanRepo stands in for the plan layer: every User has cycleDay
// (0 = no plan → calendar month), unless a test sets byUser.
type fakeCyclePlanRepo struct {
	cycleDay int
	byUser   map[uuid.UUID]int
}

func (f *fakeCyclePlanRepo) ActiveCycleStartDay(_ context.Context, userID uuid.UUID) (int, error) {
	if day, ok := f.byUser[userID]; ok {
		return day, nil
	}
	return f.cycleDay, nil
}

// newTestCycleResolver resolves against the real app timezone and clock with
// no plan for anyone — the calendar-month behaviour every pre-v2 test assumes.
func newTestCycleResolver() *CycleResolver {
	return NewCycleResolver(&fakeCyclePlanRepo{})
}
