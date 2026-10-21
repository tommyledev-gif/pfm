package service

import (
	"sort"
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// "Anything unusual?" (consult metric anomaly, owner item 9). Declared here
// rather than in model/analytics.go only because that file belongs to
// another change in flight; the values are wire values like their siblings.
const (
	analyticsMetricAnomaly model.AnalyticsMetric    = "anomaly"
	analyticsChartAnomaly  model.AnalyticsChartType = "anomaly"
)

// anomalyUnit is what one baseline sample is, with the thresholds that suit
// its length (common/constants_anomaly.go). Minimum amounts are VND xu,
// scaled for other currencies by anomalyMin.
type anomalyUnit struct {
	name             string
	minHistory       int
	categoryRatioPct int64
	minExcess        int64
	minNew           int64
}

var (
	anomalyUnitDay = anomalyUnit{
		name: "day", minHistory: common.AnomalyMinHistoryDays, categoryRatioPct: common.AnomalyCategoryRatioPctDay,
		minExcess: common.AnomalyMinExcessDayXu, minNew: common.AnomalyMinNewDayXu,
	}
	anomalyUnitWeek = anomalyUnit{
		name: "week", minHistory: common.AnomalyMinHistoryWeeks, categoryRatioPct: common.AnomalyCategoryRatioPctLong,
		minExcess: common.AnomalyMinExcessWeekXu, minNew: common.AnomalyMinNewWeekXu,
	}
	anomalyUnitCycle = anomalyUnit{
		name: "cycle", minHistory: common.AnomalyMinHistoryCycles, categoryRatioPct: common.AnomalyCategoryRatioPctLong,
		minExcess: common.AnomalyMinExcessCycleXu, minNew: common.AnomalyMinNewCycleXu,
	}
)

// anomalyScope is the period and the samples it is compared with: the 56
// local days before a day, the 8 weeks before a week, the 6 cycles before a
// cycle. Baseline windows are contiguous, oldest first, and end where the
// period starts. sameWeekday marks, for a day, the baseline days that fall
// on the period's weekday.
type anomalyScope struct {
	unit        anomalyUnit
	period      model.AnalyticsWindow
	baseline    []model.AnalyticsWindow
	sameWeekday []bool
}

// anomalyScopeFor builds the scope of a validated anomaly question
// (analyticsAnomalyPeriods: custom one day, this week, this or last cycle).
// Every bound is a local midnight in loc, stored as UTC (plan.md BR-03).
func anomalyScopeFor(q model.AnalyticsQuery, w analyticsWindows, now time.Time, loc *time.Location) anomalyScope {
	scope := anomalyScope{period: w.whole}
	switch q.Period {
	case model.AnalyticsPeriodThisWeek:
		scope.unit = anomalyUnitWeek
		start := localMidnight(w.whole.Start, loc)
		for k := common.AnomalyBaselineWeeks; k >= 1; k-- {
			from := start.AddDate(0, 0, -k*common.AnalyticsDaysPerWeek)
			scope.baseline = append(scope.baseline, spanWindow(from, from.AddDate(0, 0, common.AnalyticsDaysPerWeek), now))
		}
	case model.AnalyticsPeriodThisCycle, model.AnalyticsPeriodLastCycle:
		scope.unit = anomalyUnitCycle
		offset := 0
		if q.Period == model.AnalyticsPeriodLastCycle {
			offset = -1
		}
		for k := common.AnomalyBaselineCycles; k >= 1; k-- {
			c := ResolveCycleWindow(now, w.cycleDay, offset-k, loc)
			scope.baseline = append(scope.baseline, model.AnalyticsWindow{Start: c.Start, End: c.End})
		}
	default: // one local day
		scope.unit = anomalyUnitDay
		day := localMidnight(w.whole.Start, loc)
		for k := common.AnomalyBaselineDays; k >= 1; k-- {
			from := day.AddDate(0, 0, -k)
			scope.baseline = append(scope.baseline, spanWindow(from, from.AddDate(0, 0, 1), now))
			scope.sameWeekday = append(scope.sameWeekday, k%common.AnalyticsDaysPerWeek == 0)
		}
	}
	return scope
}

// sampleIndex is the baseline sample holding t, or -1 when t is outside the
// baseline (in the period).
func (s anomalyScope) sampleIndex(t time.Time) int {
	i := sort.Search(len(s.baseline), func(i int) bool { return s.baseline[i].End.After(t) })
	if i == len(s.baseline) || t.Before(s.baseline[i].Start) {
		return -1
	}
	return i
}

// anomalyKeepFrom is the first baseline sample whose rows were all loaded.
// The listing is newest first and capped at limit: when the cap is reached,
// the sample holding the oldest row may be missing rows, and every older
// one is missing all of them, so those are dropped instead of being judged
// on partial data.
func (s anomalyScope) anomalyKeepFrom(rows []model.AnalyticsExpense, limit int) int {
	if len(rows) < limit || len(rows) == 0 {
		return 0
	}
	i := s.sampleIndex(rows[len(rows)-1].OccurredAt)
	if i < 0 {
		return len(s.baseline) // the period alone filled the listing
	}
	return i + 1
}

// anomalyData is the period and its baseline, bucketed: everything the rules
// read, with no I/O left (analytics_anomaly_rules.go).
type anomalyData struct {
	unit           anomalyUnit
	period         []model.AnalyticsExpense
	baseline       [][]model.AnalyticsExpense
	sameWeekday    []bool
	periodIncome   []model.AnalyticsExpense
	baselineIncome []int64
}

// bucketAnomaly sorts listed rows into the period and the baseline samples
// they fall in, by their UTC instant against local-midnight bounds, so a
// 00:30 local expense lands on its own local day (spec.md S-AIQ-11).
func bucketAnomaly(scope anomalyScope, expenses, incomes []model.AnalyticsExpense, limit int) anomalyData {
	keep := scope.anomalyKeepFrom(expenses, limit)
	d := anomalyData{unit: scope.unit, baseline: make([][]model.AnalyticsExpense, len(scope.baseline)-keep)}
	if scope.sameWeekday != nil {
		d.sameWeekday = scope.sameWeekday[keep:]
	}
	for _, row := range expenses {
		if inWindow(scope.period, row.OccurredAt) {
			d.period = append(d.period, row)
		} else if i := scope.sampleIndex(row.OccurredAt); i >= keep {
			d.baseline[i-keep] = append(d.baseline[i-keep], row)
		}
	}
	keepIncome := scope.anomalyKeepFrom(incomes, limit)
	for _, row := range incomes {
		if inWindow(scope.period, row.OccurredAt) {
			d.periodIncome = append(d.periodIncome, row)
		} else if i := scope.sampleIndex(row.OccurredAt); i >= keepIncome {
			d.baselineIncome = append(d.baselineIncome, row.Amount)
		}
	}
	return d
}

func inWindow(w model.AnalyticsWindow, t time.Time) bool {
	return !t.Before(w.Start) && t.Before(w.End)
}
