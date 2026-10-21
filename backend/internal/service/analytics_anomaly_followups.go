package service

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Follow-ups of an "anything unusual?" answer: the expenses of the Category
// that stands out (or of the period, when nothing does), where the money
// went, and the same question for a neighbouring period. Every chip is a
// complete question; none needs the interpreter.

const anomalyQuestionSuffix = " có gì bất thường?"

func (b followUpBuilder) forAnomaly(answer *dto.AnalyticsAnswerResponse) []dto.AnalyticsFollowUp {
	var out []dto.AnalyticsFollowUp
	if a := answer.Chart.Anomaly; a != nil && len(a.Categories) > 0 {
		c := a.Categories[0]
		f := b.topOf([]uuid.UUID{c.CategoryID})
		f.Label = "Các khoản " + c.CategoryName
		out = append(out, f)
	} else if len(answer.Chart.Rows) == 0 {
		out = append(out, b.topOf(nil))
	}
	out = append(out, b.whereDidItGo())
	if next, ok := b.neighbourAnomaly(answer.Period.Partial); ok {
		out = append(out, next)
	}
	return out
}

// neighbourAnomaly asks the same question for the period a User checks
// next: yesterday after today, this week after a past day, this cycle after
// a week, this week after this cycle, this cycle after the last one.
func (b followUpBuilder) neighbourAnomaly(partial bool) (dto.AnalyticsFollowUp, bool) {
	thisCycle := upperFirst(b.unit) + " này" + anomalyQuestionSuffix
	thisWeek := "Tuần này" + anomalyQuestionSuffix
	switch model.AnalyticsPeriod(b.req.Period) {
	case model.AnalyticsPeriodThisWeek, model.AnalyticsPeriodLastCycle:
		return b.anomalyChip(thisCycle, model.AnalyticsPeriodThisCycle, ""), true
	case model.AnalyticsPeriodThisCycle:
		return b.anomalyChip(thisWeek, model.AnalyticsPeriodThisWeek, ""), true
	case model.AnalyticsPeriodCustom:
		if !partial {
			return b.anomalyChip(thisWeek, model.AnalyticsPeriodThisWeek, ""), true
		}
		// A single day still in progress is today: offer the day before.
		day, err := time.Parse(common.DateOnlyLayout, b.req.From)
		if err != nil {
			return dto.AnalyticsFollowUp{}, false
		}
		return b.anomalyChip("Hôm qua"+anomalyQuestionSuffix, model.AnalyticsPeriodCustom, day.AddDate(0, 0, -1).Format(common.DateOnlyLayout)), true
	}
	return dto.AnalyticsFollowUp{}, false
}

func (b followUpBuilder) anomalyChip(label string, period model.AnalyticsPeriod, day string) dto.AnalyticsFollowUp {
	q := b.base(analyticsMetricAnomaly, period)
	q.From, q.To = day, day
	q.CategoryIDs, q.WalletID = b.req.CategoryIDs, b.req.WalletID
	return dto.AnalyticsFollowUp{Label: label, Query: q}
}
