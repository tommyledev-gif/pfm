package service

import (
	"fmt"
	"reflect"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// analyticsMaxFollowUps keeps the chip row to one line on a phone.
const analyticsMaxFollowUps = 3

// followUpsFor derives the natural next questions from an answer (spec.md
// US-04). Each chip is a complete question with one thing changed, so
// tapping it needs no interpretation and never counts toward the free-text
// limit. Pure: same answer, same chips.
func followUpsFor(req dto.AnalyticsQueryRequest, answer *dto.AnalyticsAnswerResponse, monthly bool) []dto.AnalyticsFollowUp {
	b := followUpBuilder{req: req, currency: answer.Currency, unit: cycleUnit(monthly), monthly: monthly}
	var candidates []dto.AnalyticsFollowUp

	if answer.Chart.Type == string(model.AnalyticsChartNone) {
		candidates = b.forEmpty()
	} else {
		candidates = b.forMetric(answer)
	}

	out := make([]dto.AnalyticsFollowUp, 0, analyticsMaxFollowUps)
	for _, c := range candidates {
		if len(out) == analyticsMaxFollowUps {
			break
		}
		if reflect.DeepEqual(c.Query, req) {
			continue // never repeat the current question
		}
		out = append(out, c)
	}
	return out
}

type followUpBuilder struct {
	req      dto.AnalyticsQueryRequest
	currency string
	unit     string
	monthly  bool
}

func (b followUpBuilder) forMetric(answer *dto.AnalyticsAnswerResponse) []dto.AnalyticsFollowUp {
	hasCats := len(b.req.CategoryIDs) > 0
	income := b.req.TxType == string(model.TransactionTypeIncome)
	switch model.AnalyticsMetric(b.req.Metric) {
	case model.AnalyticsMetricSum:
		if income {
			return []dto.AnalyticsFollowUp{b.expenseSum(), b.compare()}
		}
		if hasCats {
			return []dto.AnalyticsFollowUp{b.compare(), b.seriesOf(b.req.CategoryIDs), b.topOf(b.req.CategoryIDs)}
		}
		if answer.Chart.Type == string(model.AnalyticsChartDonut) {
			// The total already shows where the money went (detailSum).
			return append(b.listUnlessShown(answer), b.compare(), b.avgDaily())
		}
		return []dto.AnalyticsFollowUp{b.whereDidItGo(), b.compare(), b.avgDaily()}
	case model.AnalyticsMetricCompare:
		return []dto.AnalyticsFollowUp{b.seriesOf(b.req.CategoryIDs), b.whereDidItGo()}
	case model.AnalyticsMetricSeries:
		return []dto.AnalyticsFollowUp{b.thisCycleBreakdown(), b.topOf(b.req.CategoryIDs)}
	case model.AnalyticsMetricBreakdown:
		return b.forBreakdown(answer)
	case model.AnalyticsMetricTopN, model.AnalyticsMetricMaxTx:
		return []dto.AnalyticsFollowUp{b.whereDidItGo(), b.topOf(nil)}
	case model.AnalyticsMetricAvgDaily:
		return []dto.AnalyticsFollowUp{b.weekday(), b.whereDidItGo()}
	case model.AnalyticsMetricBudgetStatus:
		return []dto.AnalyticsFollowUp{b.whereDidItGo(), b.expenseSum()}
	}
	return nil
}

func (b followUpBuilder) forBreakdown(answer *dto.AnalyticsAnswerResponse) []dto.AnalyticsFollowUp {
	switch model.AnalyticsGroupBy(b.req.GroupBy) {
	case model.AnalyticsGroupByWallet:
		return []dto.AnalyticsFollowUp{b.whereDidItGo(), b.compare()}
	case model.AnalyticsGroupByWeekday:
		return []dto.AnalyticsFollowUp{b.avgDaily(), b.whereDidItGo()}
	}
	var out []dto.AnalyticsFollowUp
	if len(answer.Chart.Items) > 0 && answer.Chart.Items[0].Key != common.AnalyticsOtherSliceKey {
		if topID, err := uuid.Parse(answer.Chart.Items[0].Key); err == nil {
			f := b.seriesOf([]uuid.UUID{topID})
			f.Label = fmt.Sprintf("%s %d %s qua", answer.Chart.Items[0].Label, common.AnalyticsSeriesMaxCycles, b.unit)
			out = append(out, f)
		}
	}
	if b.req.TxType != string(model.TransactionTypeIncome) {
		out = append(out, b.listUnlessShown(answer)...)
	}
	return append(out, b.compare(), b.byWallet())
}

// listUnlessShown offers the largest expenses of the same period, unless
// the answer already lists its expenses (attachInlineRows).
func (b followUpBuilder) listUnlessShown(answer *dto.AnalyticsAnswerResponse) []dto.AnalyticsFollowUp {
	if len(answer.Chart.Rows) > 0 {
		return nil
	}
	return []dto.AnalyticsFollowUp{b.topOf(nil)}
}

func (b followUpBuilder) forEmpty() []dto.AnalyticsFollowUp {
	if b.req.Period == string(model.AnalyticsPeriodThisCycle) && b.req.Metric != string(model.AnalyticsMetricBudgetStatus) {
		q := b.req
		q.Period = string(model.AnalyticsPeriodLastCycle)
		return []dto.AnalyticsFollowUp{{Label: "Xem " + b.unit + " trước", Query: q}}
	}
	q := b.base(model.AnalyticsMetricSum, model.AnalyticsPeriodLast3Cycles)
	return []dto.AnalyticsFollowUp{{Label: fmt.Sprintf("Xem %d %s gần nhất", common.AnalyticsSeriesShortCycles, b.unit), Query: q}}
}

// base starts a new question in the answer's currency, dropping everything
// metric-specific.
func (b followUpBuilder) base(metric model.AnalyticsMetric, period model.AnalyticsPeriod) dto.AnalyticsQueryRequest {
	return dto.AnalyticsQueryRequest{Metric: string(metric), Period: string(period), Currency: b.currency}
}

// samePeriod keeps the current period, including custom dates.
func (b followUpBuilder) samePeriod(metric model.AnalyticsMetric) dto.AnalyticsQueryRequest {
	q := b.base(metric, model.AnalyticsPeriod(b.req.Period))
	q.From, q.To = b.req.From, b.req.To
	return q
}

func (b followUpBuilder) whereDidItGo() dto.AnalyticsFollowUp {
	q := b.samePeriod(model.AnalyticsMetricBreakdown)
	q.GroupBy = string(model.AnalyticsGroupByCategory)
	if model.AnalyticsMetric(b.req.Metric) == model.AnalyticsMetricBudgetStatus || analyticsSeriesPeriods[model.AnalyticsPeriod(b.req.Period)] {
		q.Period, q.From, q.To = string(model.AnalyticsPeriodThisCycle), "", ""
	}
	return dto.AnalyticsFollowUp{Label: "Tiền đi đâu?", Query: q}
}

func (b followUpBuilder) thisCycleBreakdown() dto.AnalyticsFollowUp {
	q := b.base(model.AnalyticsMetricBreakdown, model.AnalyticsPeriodThisCycle)
	q.GroupBy = string(model.AnalyticsGroupByCategory)
	return dto.AnalyticsFollowUp{Label: upperFirst(b.unit) + " này theo hạng mục", Query: q}
}

// compare falls back to the current cycle when the period has no
// well-defined "previous".
func (b followUpBuilder) compare() dto.AnalyticsFollowUp {
	period := model.AnalyticsPeriod(b.req.Period)
	if !analyticsComparePeriods[period] {
		period = model.AnalyticsPeriodThisCycle
	}
	q := b.base(model.AnalyticsMetricCompare, period)
	q.CategoryIDs, q.TxType = b.req.CategoryIDs, b.req.TxType
	return dto.AnalyticsFollowUp{Label: "So với " + previousPeriodLabel(period, b.monthly), Query: q}
}

func (b followUpBuilder) seriesOf(ids []uuid.UUID) dto.AnalyticsFollowUp {
	q := b.base(model.AnalyticsMetricSeries, model.AnalyticsPeriodLast6Cycles)
	q.CategoryIDs, q.TxType = ids, b.req.TxType
	return dto.AnalyticsFollowUp{Label: fmt.Sprintf("Xem %d %s gần nhất", common.AnalyticsSeriesMaxCycles, b.unit), Query: q}
}

func (b followUpBuilder) topOf(ids []uuid.UUID) dto.AnalyticsFollowUp {
	period := model.AnalyticsPeriod(b.req.Period)
	if analyticsSeriesPeriods[period] {
		period = model.AnalyticsPeriodThisCycle
	}
	q := b.base(model.AnalyticsMetricTopN, period)
	if period == model.AnalyticsPeriodCustom {
		q.From, q.To = b.req.From, b.req.To
	}
	q.CategoryIDs = ids
	return dto.AnalyticsFollowUp{Label: fmt.Sprintf("%d khoản chi lớn nhất", common.AnalyticsListDefaultRows), Query: q}
}

func (b followUpBuilder) avgDaily() dto.AnalyticsFollowUp {
	return dto.AnalyticsFollowUp{Label: "Trung bình mỗi ngày", Query: b.samePeriod(model.AnalyticsMetricAvgDaily)}
}

func (b followUpBuilder) weekday() dto.AnalyticsFollowUp {
	q := b.samePeriod(model.AnalyticsMetricBreakdown)
	q.GroupBy = string(model.AnalyticsGroupByWeekday)
	return dto.AnalyticsFollowUp{Label: "Hay chi vào thứ mấy?", Query: q}
}

func (b followUpBuilder) byWallet() dto.AnalyticsFollowUp {
	q := b.samePeriod(model.AnalyticsMetricBreakdown)
	q.GroupBy = string(model.AnalyticsGroupByWallet)
	return dto.AnalyticsFollowUp{Label: "Theo ví", Query: q}
}

func (b followUpBuilder) expenseSum() dto.AnalyticsFollowUp {
	q := b.samePeriod(model.AnalyticsMetricSum)
	if model.AnalyticsMetric(b.req.Metric) == model.AnalyticsMetricBudgetStatus {
		q.Period = string(model.AnalyticsPeriodThisCycle)
	}
	return dto.AnalyticsFollowUp{Label: "Tổng chi tiêu", Query: q}
}
