package service

import (
	"context"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// computeAnomaly answers "anything unusual?": the period against the User's
// own history, by the rules in analytics_anomaly_rules.go. Two listings (one
// per type) over the period and its whole baseline; everything else is
// computed here. Figures only from recorded data, summary only from
// templates (plan.md BR-11).
func (s *AnalyticsService) computeAnomaly(ctx context.Context, run *analyticsRun) error {
	lister := s.analytics
	scope := anomalyScopeFor(run.q, run.windows, s.cycles.Now(), s.cycles.Location())
	span := model.AnalyticsWindow{Start: scope.period.Start, End: scope.period.End}
	if len(scope.baseline) > 0 {
		span.Start = scope.baseline[0].Start
	}
	list := func(txType model.TransactionType) ([]model.AnalyticsExpense, error) {
		f := run.analyticsFilter(span)
		t := string(txType)
		f.TxType = &t
		return lister.ListTransactionsInWindow(ctx, run.userID, f, common.AnomalyMaxRows)
	}
	expenses, err := list(model.TransactionTypeExpense)
	if err != nil {
		return err
	}
	incomes, err := list(model.TransactionTypeIncome)
	if err != nil {
		return err
	}

	data := bucketAnomaly(scope, expenses, incomes, common.AnomalyMaxRows)
	f := evaluateAnomaly(data, run.currency)
	run.answer.TxCount = f.count + int64(len(data.periodIncome))
	run.answer.Chart = anomalyChart(run, scope.unit, f)
	run.answer.Summary = summaryAnomaly(run, scope.unit, f)
	return nil
}

func anomalyChart(run *analyticsRun, unit anomalyUnit, f anomalyFindings) dto.AnalyticsChart {
	total := f.total
	a := &dto.AnalyticsAnomaly{
		Status: f.status, Unit: unit.name, BaselineLabel: anomalyBaselineLabel(unit, run.windows.monthly),
		Total: f.total, Count: f.count, Typical: f.typical, TypicalCount: f.typicalCount,
		HistorySamples: f.history, HistoryMin: unit.minHistory, TotalSpike: f.totalSpike, CountSpike: f.countSpike,
	}
	chart := dto.AnalyticsChart{Type: string(analyticsChartAnomaly), Value: &total, Anomaly: a}
	if f.typical != nil {
		a.TypicalLabel = upperFirst(anomalyTypicalLabel(run, unit, f.weekday))
		// No percentage: the ratio is in the summary, and a day still in
		// progress "down 40%" on a usual day would only read as a forecast.
		chart.Compare = &dto.AnalyticsCompare{
			Current: f.total, Previous: *f.typical,
			CurrentLabel: periodLabel(run.q.Period, run.windows, true), PreviousLabel: a.TypicalLabel,
		}
	}
	for _, c := range f.categories {
		a.Categories = append(a.Categories, dto.AnalyticsAnomalyCategory{CategoryID: c.id, CategoryName: c.name, Amount: c.amount, Typical: c.typical})
	}
	if len(f.large) > 0 {
		rows := make([]model.AnalyticsExpense, 0, len(f.large))
		for _, l := range f.large {
			rows = append(rows, l.row)
		}
		chart.Rows = txRows(rows)
	}
	if len(f.income) > 0 {
		a.Income = txRows(f.income)
	}
	return chart
}
