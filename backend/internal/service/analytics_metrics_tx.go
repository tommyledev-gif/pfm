package service

import (
	"context"
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// analyticsMaxDailyPoints bounds Q11's daily line: one cycle's worth of days.
const analyticsMaxDailyPoints = 31

// computeTopExpenses answers Q5/Q6 (ranked list) and Q14 (single largest).
// total_matched tells the User how many matched beyond the rows shown
// (spec.md US-02 EC).
func (s *AnalyticsService) computeTopExpenses(ctx context.Context, run *analyticsRun) error {
	limit := run.q.Limit
	if limit == 0 {
		limit = common.AnalyticsListDefaultRows
	}
	if run.q.Metric == model.AnalyticsMetricMaxTx {
		limit = 1
	}
	filter := run.analyticsFilter(run.windows.whole)
	// Fetched past the answer's own limit so the list can expand in place;
	// the answer itself is still only the first `limit` rows.
	rows, err := s.analytics.ListExpensesByAmount(ctx, run.userID, filter, max(limit, common.AnalyticsListExpandMaxRows))
	if err != nil {
		return err
	}
	expense := string(model.TransactionTypeExpense)
	filter.TxType = &expense
	matched, err := s.analytics.CountTransactions(ctx, run.userID, filter)
	if err != nil {
		return err
	}
	run.answer.TxCount = matched
	if len(rows) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	out := make([]dto.AnalyticsTxRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.AnalyticsTxRow{
			ID: r.ID, OccurredAt: r.OccurredAt, Amount: r.Amount,
			CategoryID: r.CategoryID, CategoryName: r.CategoryName, WalletName: r.WalletName,
		})
	}
	shown, more := out, []dto.AnalyticsTxRow(nil)
	if len(out) > limit {
		shown, more = out[:limit], out[limit:]
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartTable), Rows: shown, MoreRows: more, TotalMatched: &matched}
	run.answer.Summary = summaryTop(run, shown, matched, s.cycles.Location())
	return nil
}

// computeAvgDaily answers Q11: total ÷ days with at least one expense
// (spec.md A-03), and says how many days that is.
func (s *AnalyticsService) computeAvgDaily(ctx context.Context, run *analyticsRun) error {
	days, err := s.expenseDays(ctx, run)
	if err != nil {
		return err
	}
	if len(days) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	var total int64
	for _, d := range days {
		total += d.Amount
	}
	avg := divRoundHalfUp(total, int64(len(days)))
	n := len(days)
	chart := dto.AnalyticsChart{Type: string(model.AnalyticsChartNumber), Value: &avg, Days: &n}
	if len(days) <= analyticsMaxDailyPoints {
		for _, d := range days {
			chart.Items = append(chart.Items, dto.AnalyticsChartItem{Key: d.Day.Format(common.DateOnlyLayout), Label: shortDate(d.Day), Amount: d.Amount})
		}
	}
	run.answer.Chart = chart
	run.answer.Summary = summaryAvgDaily(run, avg, n)
	return nil
}

// computeWeekday answers Q13 — Monday first, all seven days always present.
func (s *AnalyticsService) computeWeekday(ctx context.Context, run *analyticsRun) error {
	days, err := s.expenseDays(ctx, run)
	if err != nil {
		return err
	}
	if len(days) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	totals := make([]int64, common.AnalyticsDaysPerWeek)
	for _, d := range days {
		totals[mondayIndex(d.Day.Weekday())] += d.Amount
	}
	items := make([]dto.AnalyticsChartItem, common.AnalyticsDaysPerWeek)
	top := 0
	for i, amount := range totals {
		items[i] = dto.AnalyticsChartItem{Key: weekdayKeys[i], Label: weekdayLabels[i], Amount: amount}
		if amount > totals[top] {
			top = i
		}
	}
	if windowDays(run.windows.whole, s.cycles.Location()) < common.AnalyticsWeekPatternMinDays {
		run.answer.Notices = append(run.answer.Notices, noticePeriodTooShort())
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartWeekday), Items: items}
	run.answer.Summary = summaryWeekday(run, items[top])
	return nil
}

// computeWalletBreakdown answers Q8.
func (s *AnalyticsService) computeWalletBreakdown(ctx context.Context, run *analyticsRun) error {
	rows, err := s.analytics.SumExpenseByWallet(ctx, run.userID, run.analyticsFilter(run.windows.whole))
	if err != nil {
		return err
	}
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	if len(rows) == 0 {
		run.answer.Summary = summaryEmpty(run)
		return nil
	}
	items := make([]dto.AnalyticsChartItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, dto.AnalyticsChartItem{Key: r.Key.String(), Label: r.Label, Amount: r.Amount})
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartBar), Items: capSlices(items)}
	run.answer.Summary = summaryWalletBreakdown(run, items[0])
	return nil
}

// computeBudgetStatus answers Q9 through BudgetService.ListBudgets itself, so
// every figure equals the Budgets screen (spec.md S-AIQ-09).
func (s *AnalyticsService) computeBudgetStatus(ctx context.Context, run *analyticsRun) error {
	budgets, err := s.budgets.ListBudgets(ctx, run.userID)
	if err != nil {
		return err
	}
	if run.answer.TxCount, err = s.countIn(ctx, run, run.windows.whole); err != nil {
		return err
	}
	var items []dto.AnalyticsBudgetItem
	for _, b := range budgets {
		for _, l := range b.Limits {
			if l.Currency != run.currency {
				continue
			}
			items = append(items, dto.AnalyticsBudgetItem{
				BudgetID: b.ID, CategoryID: b.CategoryID, CategoryName: b.CategoryName, Icon: b.Icon, IconURL: b.IconURL,
				Limit: l.AmountLimit,
				Spent: l.Spent, Remaining: l.Remaining, Exceeded: l.Status == model.BudgetStatusExceeded,
			})
		}
	}
	if len(items) == 0 {
		run.answer.Summary = summaryNoBudgets()
		return nil
	}
	run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartProgress), Budgets: items}
	run.answer.Summary = summaryBudgets(run, items)
	return nil
}

func (s *AnalyticsService) expenseDays(ctx context.Context, run *analyticsRun) ([]model.AnalyticsDayAmount, error) {
	rows, err := s.analytics.SumExpenseByLocalDay(ctx, run.userID, run.analyticsFilter(run.windows.whole), common.AppTimezone)
	if err != nil {
		return nil, err
	}
	count, err := s.countIn(ctx, run, run.windows.whole)
	if err != nil {
		return nil, err
	}
	run.answer.TxCount = count
	days := rows[:0]
	for _, r := range rows {
		if r.Amount > 0 {
			days = append(days, r)
		}
	}
	return days, nil
}

// mondayIndex maps Go's Sunday-first weekday to a Monday-first index.
func mondayIndex(d time.Weekday) int {
	return (int(d) + common.AnalyticsDaysPerWeek - int(time.Monday)) % common.AnalyticsDaysPerWeek
}
