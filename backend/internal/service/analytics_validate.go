package service

import (
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

const (
	analyticsRuleCustomOnly      = "only_with_custom_period"
	analyticsRuleRequiredCustom  = "required_for_custom_period"
	analyticsRuleFromAfterTo     = "from_after_to"
	analyticsRuleRangeTooLong    = "range_too_long"
	analyticsRuleIncompatible    = "incompatible_with_metric"
	analyticsRuleRequiredForKind = "required_for_metric"
	analyticsRuleInvalidDate     = "invalid_date"
)

// analyticsRuleError is one entry in a 400's details — every broken rule is
// reported together (plan.md API table: independent checks).
type analyticsRuleError struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
}

// Periods each metric accepts. Series needs several cycles; compare needs a
// period with a well-defined "previous"; budget status is always the current
// cycle, because Budgets only exist for it.
var (
	analyticsSeriesPeriods = map[model.AnalyticsPeriod]bool{
		model.AnalyticsPeriodLast3Cycles: true, model.AnalyticsPeriodLast6Cycles: true,
	}
	analyticsComparePeriods = map[model.AnalyticsPeriod]bool{
		model.AnalyticsPeriodThisCycle: true, model.AnalyticsPeriodLastCycle: true,
		model.AnalyticsPeriodThisWeek: true, model.AnalyticsPeriodLast30Days: true,
	}
	// Anomaly: one day (custom, from = to), this week, or one cycle.
	analyticsAnomalyPeriods = map[model.AnalyticsPeriod]bool{
		model.AnalyticsPeriodCustom: true, model.AnalyticsPeriodThisWeek: true,
		model.AnalyticsPeriodThisCycle: true, model.AnalyticsPeriodLastCycle: true,
	}
	// Metrics whose SQL is expense-only; income makes sense only on the
	// report-backed ones.
	analyticsIncomeMetrics = map[model.AnalyticsMetric]bool{
		model.AnalyticsMetricSum: true, model.AnalyticsMetricCompare: true, model.AnalyticsMetricSeries: true,
	}
)

// toAnalyticsQuery converts a shape-valid request into the domain question
// and checks every cross-field business rule (plan.md BR-02).
func toAnalyticsQuery(req dto.AnalyticsQueryRequest) (model.AnalyticsQuery, error) {
	q := model.AnalyticsQuery{
		Metric:      model.AnalyticsMetric(req.Metric),
		GroupBy:     model.AnalyticsGroupBy(req.GroupBy),
		TxType:      req.TxType,
		Period:      model.AnalyticsPeriod(req.Period),
		CategoryIDs: req.CategoryIDs,
		WalletID:    req.WalletID,
		AmountMin:   req.AmountMin,
		Limit:       req.Limit,
		Currency:    req.Currency,
	}
	if q.TxType == "" {
		q.TxType = string(model.TransactionTypeExpense)
	}

	var problems []analyticsRuleError
	add := func(field, rule string) { problems = append(problems, analyticsRuleError{Field: field, Rule: rule}) }

	problems = append(problems, validateAnalyticsDates(req, &q)...)

	switch q.Metric {
	case model.AnalyticsMetricBreakdown:
		if q.GroupBy == "" {
			add("group_by", analyticsRuleRequiredForKind)
		}
	case model.AnalyticsMetricSeries:
		if !analyticsSeriesPeriods[q.Period] {
			add("period", analyticsRuleIncompatible)
		}
	case model.AnalyticsMetricCompare:
		if !analyticsComparePeriods[q.Period] {
			add("period", analyticsRuleIncompatible)
		}
	case model.AnalyticsMetricBudgetStatus:
		if q.Period != model.AnalyticsPeriodThisCycle {
			add("period", analyticsRuleIncompatible)
		}
		if q.WalletID != nil {
			add("wallet_id", analyticsRuleIncompatible)
		}
	case analyticsMetricAnomaly:
		// A day is compared with days, a week with weeks, a cycle with
		// cycles; a range of some other length has no samples to compare.
		if !analyticsAnomalyPeriods[q.Period] {
			add("period", analyticsRuleIncompatible)
		}
		if q.From != nil && q.To != nil && !q.From.Equal(*q.To) {
			add("to", analyticsRuleIncompatible)
		}
	}
	if q.Metric != model.AnalyticsMetricBreakdown && q.GroupBy != "" {
		add("group_by", analyticsRuleIncompatible)
	}
	if q.Metric != model.AnalyticsMetricTopN && (q.AmountMin != nil || q.Limit != 0) {
		if q.AmountMin != nil {
			add("amount_min", analyticsRuleIncompatible)
		}
		if q.Limit != 0 {
			add("limit", analyticsRuleIncompatible)
		}
	}
	// An anomaly answer always looks at spending and income both, so an
	// income-worded question is answered, not refused.
	incomeOK := analyticsIncomeMetrics[q.Metric] || q.Metric == analyticsMetricAnomaly ||
		(q.Metric == model.AnalyticsMetricBreakdown && q.GroupBy == model.AnalyticsGroupByCategory)
	if q.TxType == string(model.TransactionTypeIncome) && !incomeOK {
		add("tx_type", analyticsRuleIncompatible)
	}
	if q.Metric == model.AnalyticsMetricBreakdown && q.GroupBy != model.AnalyticsGroupByCategory && len(q.CategoryIDs) > 0 {
		add("category_ids", analyticsRuleIncompatible)
	}

	if len(problems) > 0 {
		return model.AnalyticsQuery{}, common.NewInvalidInputErrorWithDetails("analytics question is not answerable as asked", problems)
	}
	return q, nil
}

// validateAnalyticsDates parses custom-period dates as local calendar days.
func validateAnalyticsDates(req dto.AnalyticsQueryRequest, q *model.AnalyticsQuery) []analyticsRuleError {
	var problems []analyticsRuleError
	isCustom := q.Period == model.AnalyticsPeriodCustom
	if !isCustom {
		if req.From != "" {
			problems = append(problems, analyticsRuleError{Field: "from", Rule: analyticsRuleCustomOnly})
		}
		if req.To != "" {
			problems = append(problems, analyticsRuleError{Field: "to", Rule: analyticsRuleCustomOnly})
		}
		return problems
	}
	if req.From == "" {
		problems = append(problems, analyticsRuleError{Field: "from", Rule: analyticsRuleRequiredCustom})
	}
	if req.To == "" {
		problems = append(problems, analyticsRuleError{Field: "to", Rule: analyticsRuleRequiredCustom})
	}
	if len(problems) > 0 {
		return problems
	}
	// The DTO tag checks the shape only on the HTTP path; the free-text path
	// builds this request itself, and a well-shaped date can still not exist
	// ("2026-02-31"). A discarded parse error would be a zero time here.
	from, fromErr := time.ParseInLocation(common.DateOnlyLayout, req.From, common.AppLocation)
	if fromErr != nil {
		problems = append(problems, analyticsRuleError{Field: "from", Rule: analyticsRuleInvalidDate})
	}
	to, toErr := time.ParseInLocation(common.DateOnlyLayout, req.To, common.AppLocation)
	if toErr != nil {
		problems = append(problems, analyticsRuleError{Field: "to", Rule: analyticsRuleInvalidDate})
	}
	if len(problems) > 0 {
		return problems
	}
	if from.After(to) {
		return []analyticsRuleError{{Field: "from", Rule: analyticsRuleFromAfterTo}}
	}
	if to.Sub(from) >= common.AnalyticsCustomRangeMaxDays*hoursPerDay*time.Hour {
		return []analyticsRuleError{{Field: "to", Rule: analyticsRuleRangeTooLong}}
	}
	q.From, q.To = &from, &to
	return nil
}
