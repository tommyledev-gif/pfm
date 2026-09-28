package service

import (
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

const (
	msgDayUnsupported = "Mình chỉ trả lời được cho một ngày đã qua hoặc hôm nay. Bạn thử câu dưới đây nhé."
	todayChipLabel    = "Hôm nay tiêu bao nhiêu?"
)

// consultDayGuard turns away the single-day questions the catalog cannot
// answer, before any figure is read (specs/ai-chat-query-spending/plan.md
// BR-27). It runs on the free-text path only: this path builds its request
// without the DTO's validate tags, so a date the model produced has not been
// checked by anything yet (plan.md R-F22). Nil means "carry on".
//
//   - EC-30: a date that does not exist ("31/2") — never moved to a nearby one.
//   - EC-29: a single day after today — no projections, not even for
//     Transactions already dated in the future. A multi-day range reaching
//     past today is still answered "so far", as before.
//   - EC-32: comparing single days — a one-day range has no previous period.
//
// today is the caller's own local date (YYYY-MM-DD), never model output.
func consultDayGuard(p *AIConsultParse, today, currency string) *dto.ConsultResponse {
	if p.Period != string(model.AnalyticsPeriodCustom) {
		return nil
	}
	from, fromErr := time.Parse(common.DateOnlyLayout, p.From)
	to, toErr := time.Parse(common.DateOnlyLayout, p.To)
	if fromErr == nil && toErr == nil {
		if !from.Equal(to) {
			return nil
		}
		day, err := time.Parse(common.DateOnlyLayout, today)
		future := err == nil && to.After(day)
		if !future && p.Metric != string(model.AnalyticsMetricCompare) {
			return nil
		}
	}
	return &dto.ConsultResponse{
		Kind: string(model.ConsultKindUnsupported), Message: msgDayUnsupported,
		Chips: []dto.AnalyticsFollowUp{todayChip(today, currency), starterChips(currency)[0]},
	}
}

// todayChip is the nearest supported question for a day the guard turned
// away: today's total, as a one-day explicit range.
func todayChip(today, currency string) dto.AnalyticsFollowUp {
	return dto.AnalyticsFollowUp{Label: todayChipLabel, Query: dto.AnalyticsQueryRequest{
		Metric: string(model.AnalyticsMetricSum), Period: string(model.AnalyticsPeriodCustom),
		From: today, To: today, Currency: currency,
	}}
}
