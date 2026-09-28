package service

import (
	"fmt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// How a period is named in an answer's copy. Split from analytics_template.go
// so the sentence templates and the period wording can each grow on their own
// (file size rule). Vietnamese, per the product's copy rule.

const (
	soFarPrefix      = "Tính đến hôm nay, "
	soFarTodayPrefix = "Tính đến giờ, "
)

// periodLabel names a period in running text ("tháng này", "3 kỳ gần nhất").
func periodLabel(p model.AnalyticsPeriod, w analyticsWindows, capitalize bool) string {
	unit := cycleUnit(w.monthly)
	var label string
	switch p {
	case model.AnalyticsPeriodThisCycle:
		label = unit + " này"
	case model.AnalyticsPeriodLastCycle:
		label = unit + " trước"
	case model.AnalyticsPeriodLast3Cycles, model.AnalyticsPeriodLast6Cycles:
		label = fmt.Sprintf("%d %s gần nhất", analyticsSeriesLength(p), unit)
	case model.AnalyticsPeriodLast30Days:
		label = fmt.Sprintf("%d ngày qua", common.AnalyticsLastDaysWindow)
	case model.AnalyticsPeriodThisWeek:
		label = "tuần này"
	default:
		label = customLabel(w)
	}
	if capitalize {
		return upperFirst(label)
	}
	return label
}

// customLabel names an explicit range. A single day reads as that day, not
// as "from 28/09 to 28/09" (specs/ai-chat-query-spending/plan.md BR-29).
func customLabel(w analyticsWindows) string {
	first := shortDate(w.whole.Start.In(common.AppLocation))
	switch {
	case w.isToday:
		return fmt.Sprintf("hôm nay (%s)", first)
	case w.singleDay:
		return "ngày " + first
	}
	return fmt.Sprintf("từ %s đến %s", first, shortDate(w.whole.End.Add(-reportBoundResolution).In(common.AppLocation)))
}

// periodIn is the period as the object of "no spending …": "trong tháng
// này", "vào ngày 27/09", "hôm nay (28/09)", "từ 01/09 đến 15/09" — a range
// already carries its own preposition.
func periodIn(run *analyticsRun) string {
	label := periodLabel(run.q.Period, run.windows, false)
	if run.q.Period != model.AnalyticsPeriodCustom {
		return "trong " + label
	}
	if run.windows.singleDay && !run.windows.isToday {
		return "vào " + label
	}
	return label
}

func previousPeriodLabel(p model.AnalyticsPeriod, monthly bool) string {
	unit := cycleUnit(monthly)
	switch p {
	case model.AnalyticsPeriodLastCycle:
		return unit + " trước nữa"
	case model.AnalyticsPeriodThisWeek:
		return "tuần trước"
	case model.AnalyticsPeriodLast30Days:
		return fmt.Sprintf("%d ngày trước đó", common.AnalyticsLastDaysWindow)
	default:
		return unit + " trước"
	}
}

// soFar prefixes sentences about a period that has not ended (spec.md EC-04).
// Today, as a single day, is still in progress too — "up to now", since
// "up to today" about today says nothing (S-AIQ-49).
func soFar(run *analyticsRun) string {
	if !run.windows.whole.Partial {
		return ""
	}
	if run.windows.isToday {
		return soFarTodayPrefix
	}
	if run.q.Period != model.AnalyticsPeriodCustom {
		return soFarPrefix
	}
	return ""
}

func lead(run *analyticsRun) string {
	label := periodLabel(run.q.Period, run.windows, false)
	if prefix := soFar(run); prefix != "" {
		return prefix + label
	}
	return upperFirst(label)
}
