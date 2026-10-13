package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// What an answer says about *what* the money went on. "Tiêu hôm nay" used to
// come back as one figure and a count, so the User had to ask a second
// question to learn what it was spent on. A total now carries the
// Categories behind it, and a short period carries its expenses themselves.

// categoryItems sums the answer's window by Category for its type and
// currency, amount-descending (the report query's own order), keeping only
// the Categories the question named, if it named any.
func (s *AnalyticsService) categoryItems(ctx context.Context, run *analyticsRun) ([]dto.AnalyticsChartItem, int64, error) {
	rows, err := s.reports.SumByCategory(ctx, run.userID, reportFilter(run.windows.whole, run.q.WalletID, run.q.TxType))
	if err != nil {
		return nil, 0, err
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
	return items, total, nil
}

// detailSum adds the Categories behind a total — drawn as the breakdown's
// donut, with the total as its value — unless the question named exactly
// one Category, where the split would only repeat the total.
func (s *AnalyticsService) detailSum(ctx context.Context, run *analyticsRun, total int64) error {
	if len(run.q.CategoryIDs) != 1 {
		items, _, err := s.categoryItems(ctx, run)
		if err != nil {
			return err
		}
		if len(items) > 0 {
			run.answer.Chart = dto.AnalyticsChart{Type: string(model.AnalyticsChartDonut), Items: capSlices(items), Value: &total}
			run.answer.Summary += " " + summaryTopCategory(run, items)
		}
	}
	return s.attachInlineRows(ctx, run)
}

// attachInlineRows lists the expenses themselves when there are few enough
// to read at a glance, largest first like every list answer. Expenses only:
// the list query has no income counterpart, and income questions ask "how
// much", not "on what".
func (s *AnalyticsService) attachInlineRows(ctx context.Context, run *analyticsRun) error {
	if isIncome(run) || run.answer.TxCount == 0 || run.answer.TxCount > common.AnalyticsInlineRowsMax {
		return nil
	}
	rows, err := s.analytics.ListExpensesByAmount(ctx, run.userID, run.analyticsFilter(run.windows.whole), common.AnalyticsInlineRowsMax)
	if err != nil {
		return err
	}
	if len(rows) > 0 {
		run.answer.Chart.Rows = txRows(rows)
	}
	return nil
}

// txRows maps listed expenses onto the answer's rows — never a note
// (plan.md BR-22).
func txRows(rows []model.AnalyticsExpense) []dto.AnalyticsTxRow {
	out := make([]dto.AnalyticsTxRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.AnalyticsTxRow{
			ID: r.ID, OccurredAt: r.OccurredAt, Amount: r.Amount,
			CategoryID: r.CategoryID, CategoryName: r.CategoryName, WalletName: r.WalletName,
		})
	}
	return out
}
