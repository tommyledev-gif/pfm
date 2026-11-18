package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// cycleBaseline is the average monthly income and spending over the last
// completed cycles that had any activity in one currency. The savings-goal
// plan and the spending-intention figures read the same baseline, so the two
// can never disagree about what the User usually has left.
type cycleBaseline struct {
	cycles  int
	income  int64
	expense int64
	// monthly is true when the User's cycles are calendar months.
	monthly bool
	// byCategory is each expense Category's average monthly spending over the
	// same cycles — the "usual" a later month's Budget is weighed against.
	// Filled only when asked for (withCategories).
	byCategory map[uuid.UUID]int64
}

// loadCycleBaseline averages up to `lookback` completed cycles. Cycles with no
// income and no spending in `currency` are skipped, so a User who started
// recording last month is averaged over one cycle, not three.
func loadCycleBaseline(ctx context.Context, cycles *CycleResolver, reports ReportRepo, userID uuid.UUID, currency string, lookback int, withCategories bool) (cycleBaseline, error) {
	day, err := cycles.plans.ActiveCycleStartDay(ctx, userID)
	if err != nil {
		return cycleBaseline{}, err
	}
	now, loc := cycles.Now(), cycles.Location()
	base := cycleBaseline{monthly: ResolveCycleWindow(now, day, 0, loc).Start.In(loc).Day() == budgetCycleMinDay}
	if withCategories {
		base.byCategory = map[uuid.UUID]int64{}
	}
	for offset := -1; offset >= -lookback; offset-- {
		w := ResolveCycleWindow(now, day, offset, loc)
		rows, err := reports.SumTotals(ctx, userID, repository.ReportFilter{From: w.Start, To: w.End.Add(-reportBoundResolution)})
		if err != nil {
			return cycleBaseline{}, err
		}
		var income, expense int64
		for _, row := range rows {
			if row.Currency != currency {
				continue
			}
			switch row.Type {
			case string(model.TransactionTypeIncome):
				income += row.Amount
			case string(model.TransactionTypeExpense):
				expense += row.Amount
			}
		}
		if income == 0 && expense == 0 {
			continue
		}
		base.cycles++
		base.income += income
		base.expense += expense
		if withCategories {
			if err := base.addCategorySpending(ctx, reports, userID, repository.ReportFilter{From: w.Start, To: w.End.Add(-reportBoundResolution)}, currency); err != nil {
				return cycleBaseline{}, err
			}
		}
	}
	if base.cycles > 0 {
		base.income /= int64(base.cycles)
		base.expense /= int64(base.cycles)
		for id, total := range base.byCategory {
			base.byCategory[id] = total / int64(base.cycles)
		}
	}
	return base, nil
}

// addCategorySpending adds one cycle's expense per Category.
func (b *cycleBaseline) addCategorySpending(ctx context.Context, reports ReportRepo, userID uuid.UUID, filter repository.ReportFilter, currency string) error {
	expense := string(model.TransactionTypeExpense)
	filter.Type = &expense
	rows, err := reports.SumByCategory(ctx, userID, filter)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if row.Currency == currency {
			b.byCategory[row.CategoryID] += row.Amount
		}
	}
	return nil
}

// surplusOf is the usual income minus the usual spending, rounded down onto
// the suggested step so it never overstates what the User can set aside.
// Nil without any completed cycle with activity.
func surplusOf(base cycleBaseline, currency string) *int64 {
	if base.cycles == 0 {
		return nil
	}
	surplus := roundDown(roundNearest(base.income, currency)-roundNearest(base.expense, currency), currency)
	return &surplus
}
