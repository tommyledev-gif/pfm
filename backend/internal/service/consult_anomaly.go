package service

import (
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

const (
	msgAnomalyPeriod      = "Chỉ xem được một ngày, tuần này, tháng này hoặc tháng trước. Thử:"
	anomalyTodayChipLabel = "Hôm nay có gì bất thường?"
	anomalyCycleChipLabel = "Tháng này có gì bất thường?"
)

// consultAnomalyGuard turns away an "anything unusual?" question over a
// period the rules cannot compare (several days, the last 30 days, several
// cycles) before AnalyticsService would reject it as invalid input — that
// path reads "did not understand", which is not what happened here. It runs
// after consultDayGuard, so a single day is already known to exist and not
// to be in the future. Nil means "carry on".
func consultAnomalyGuard(p *AIConsultParse, today, currency string) *dto.ConsultResponse {
	if p.Metric != string(analyticsMetricAnomaly) {
		return nil
	}
	switch model.AnalyticsPeriod(p.Period) {
	case model.AnalyticsPeriodThisWeek, model.AnalyticsPeriodThisCycle, model.AnalyticsPeriodLastCycle:
		return nil
	case model.AnalyticsPeriodCustom:
		if p.From != "" && p.From == p.To {
			return nil
		}
	}
	return &dto.ConsultResponse{
		Kind: string(model.ConsultKindUnsupported), Message: msgAnomalyPeriod,
		Chips: []dto.AnalyticsFollowUp{anomalyTodayChip(today, currency), anomalyCycleChip(currency)},
	}
}

// anomalyTodayChip: "anything unusual today", as a one-day explicit range.
func anomalyTodayChip(today, currency string) dto.AnalyticsFollowUp {
	return dto.AnalyticsFollowUp{Label: anomalyTodayChipLabel, Query: dto.AnalyticsQueryRequest{
		Metric: string(analyticsMetricAnomaly), Period: string(model.AnalyticsPeriodCustom),
		From: today, To: today, Currency: currency,
	}}
}

func anomalyCycleChip(currency string) dto.AnalyticsFollowUp {
	return dto.AnalyticsFollowUp{Label: anomalyCycleChipLabel, Query: dto.AnalyticsQueryRequest{
		Metric: string(analyticsMetricAnomaly), Period: string(model.AnalyticsPeriodThisCycle), Currency: currency,
	}}
}
