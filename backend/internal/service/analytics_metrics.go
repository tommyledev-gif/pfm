package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// reportBoundResolution is PostgreSQL timestamptz precision (plan.md F6).
const reportBoundResolution = time.Microsecond

// sumReport totals one type in one window for the answer currency, through
// the same queries as F-07 (plan.md BR-05). Non-zero totals in other
// currencies are remembered for the "not included" notice (spec.md S-AIQ-12).
func (s *AnalyticsService) sumReport(ctx context.Context, run *analyticsRun, w model.AnalyticsWindow) (int64, error) {
	filter := reportFilter(w, run.q.WalletID, run.q.TxType)
	var total int64
	if len(run.q.CategoryIDs) == 0 {
		rows, err := s.reports.SumTotals(ctx, run.userID, filter)
		if err != nil {
			return 0, err
		}
		for _, row := range rows {
			total += run.keep(row.Type, row.Currency, row.Amount)
		}
		return total, nil
	}
	wanted := make(map[uuid.UUID]bool, len(run.q.CategoryIDs))
	for _, id := range run.q.CategoryIDs {
		wanted[id] = true
	}
	rows, err := s.reports.SumByCategory(ctx, run.userID, filter)
	if err != nil {
		return 0, err
	}
	for _, row := range rows {
		if wanted[row.CategoryID] {
			total += run.keep(row.Type, row.Currency, row.Amount)
		}
	}
	return total, nil
}

// keep returns amount if it is the answer's type and currency; a non-zero
// amount in another currency is recorded instead of added (A-01).
func (run *analyticsRun) keep(txType, currency string, amount int64) int64 {
	if txType != run.q.TxType {
		return 0
	}
	if currency != run.currency {
		if amount != 0 {
			run.otherCurrency[currency] = true
		}
		return 0
	}
	return amount
}

func (s *AnalyticsService) countIn(ctx context.Context, run *analyticsRun, w model.AnalyticsWindow) (int64, error) {
	f := run.analyticsFilter(w)
	t := run.q.TxType
	f.TxType = &t
	return s.analytics.CountTransactions(ctx, run.userID, f)
}

// computeSum answers Q1/Q10.
func (s *AnalyticsService) computeSum(ctx context.Context, run *analyticsRun) error {
	total, err := s.sumReport(ctx, run, run.windows.whole)
	if err != nil {
		return err
	}
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	if run.answer.TxCount == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartNumber), Value: &total}
	run.answer.Summary = summarySum(run, total)
	return nil
}

// computeCompare answers Q4. A zero previous period yields no percentage
// (spec.md S-AIQ-08), never a division by zero.
func (s *AnalyticsService) computeCompare(ctx context.Context, run *analyticsRun) error {
	current, err := s.sumReport(ctx, run, run.windows.whole)
	if err != nil {
		return err
	}
	previous, err := s.sumReport(ctx, run, *run.windows.prev)
	if err != nil {
		return err
	}
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	if current == 0 && previous == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	cmp := &dto.AnalyticsCompare{
		Current: current, Previous: previous,
		CurrentLabel:  periodLabel(run.q.Period, run.windows, false),
		PreviousLabel: previousPeriodLabel(run.q.Period, run.windows.monthly),
	}
	if previous != 0 {
		pct := divRoundSigned((current-previous)*common.AnalyticsPercentScale, previous)
		cmp.ChangePct = &pct
	} else {
		run.answer.Notices = append(run.answer.Notices, noticeNoPreviousData())
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartCompare), Compare: cmp}
	run.answer.Summary = summaryCompare(run, cmp)
	return nil
}

// computeSeries answers Q3 (all spending, bars) and Q12 (Categories, line):
// one report call per cycle, so every bar equals Insights for that cycle
// (plan.md BR-07). Leading cycles with no data are dropped and the answer
// says how many cycles there are (spec.md US-02 EC).
func (s *AnalyticsService) computeSeries(ctx context.Context, run *analyticsRun) error {
	items := make([]dto.AnalyticsChartItem, 0, len(run.windows.parts))
	loc := s.cycles.Location()
	for _, part := range run.windows.parts {
		total, err := s.sumReport(ctx, run, part)
		if err != nil {
			return err
		}
		items = append(items, dto.AnalyticsChartItem{
			Key: part.Start.In(loc).Format(common.DateOnlyLayout), Label: cycleLabel(part, run.windows.monthly, loc), Amount: total,
		})
	}
	for len(items) > 0 && items[0].Amount == 0 {
		items = items[1:]
	}
	var err error
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	if len(items) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	if len(items) < len(run.windows.parts) {
		run.answer.Notices = append(run.answer.Notices, noticeFewerCycles(len(items), run.windows.monthly))
	}
	chartType := model.AnalyticsChartBar
	if len(run.q.CategoryIDs) > 0 {
		chartType = model.AnalyticsChartLine
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(chartType), Items: items}
	run.answer.Summary = summarySeries(run, items)
	return nil
}

// computeCategoryBreakdown answers Q2. Small Categories fold into "Other"
// in the visual only; the total is unchanged (spec.md US-02 EC).
func (s *AnalyticsService) computeCategoryBreakdown(ctx context.Context, run *analyticsRun) error {
	rows, err := s.reports.SumByCategory(ctx, run.userID, reportFilter(run.windows.whole, run.q.WalletID, run.q.TxType))
	if err != nil {
		return err
	}
	wanted := make(map[uuid.UUID]bool, len(run.q.CategoryIDs))
	for _, id := range run.q.CategoryIDs {
		wanted[id] = true
	}
	var items []dto.AnalyticsChartItem
	var total int64
	for _, row := range rows {
		if len(wanted) > 0 && !wanted[row.CategoryID] {
			continue
		}
		amount := run.keep(row.Type, row.Currency, row.Amount)
		if amount == 0 {
			continue
		}
		items = append(items, dto.AnalyticsChartItem{Key: row.CategoryID.String(), Label: row.CategoryName, Amount: amount})
		total += amount
	}
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	if len(items) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartDonut), Items: capSlices(items), Value: &total}
	run.answer.Summary = summaryBreakdown(run, items[0], total)
	return nil
}

// capSlices keeps the largest slices (input is amount-descending) and folds
// the rest into one "Other" slice (plan.md BR-12).
func capSlices(items []dto.AnalyticsChartItem) []dto.AnalyticsChartItem {
	if len(items) <= common.AnalyticsBreakdownMaxSlices {
		return items
	}
	kept := append([]dto.AnalyticsChartItem{}, items[:common.AnalyticsBreakdownMaxSlices]...)
	var rest int64
	for _, item := range items[common.AnalyticsBreakdownMaxSlices:] {
		rest += item.Amount
	}
	return append(kept, dto.AnalyticsChartItem{Key: common.AnalyticsOtherSliceKey, Label: labelOther, Amount: rest})
}

// divRoundHalfUp is a/b rounded half-up for non-negative integers — the
// only rounding used for money here (average per day, series average).
func divRoundHalfUp(a, b int64) int64 {
	return (2*a + b) / (2 * b)
}

// divRoundSigned rounds a/b half away from zero (percent change may be
// negative).
func divRoundSigned(a, b int64) int64 {
	negative := (a < 0) != (b < 0)
	if a < 0 {
		a = -a
	}
	if b < 0 {
		b = -b
	}
	q := divRoundHalfUp(a, b)
	if negative {
		return -q
	}
	return q
}
