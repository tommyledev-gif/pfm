package service

import (
	"fmt"

	"github.com/example/pfm/backend/internal/common"
)

// Copy of the "anything unusual?" answer (pfm-ux-copy: facts first, real
// figures, at most two sentences in the bubble; the card shows the rest).
// Built only from computed findings, never from model output (plan.md BR-11).

const anomalyRatioTenths = 10

// summaryAnomaly: what is unusual, most telling finding first; or a plain
// "nothing unusual" with the period against its usual; or why there is no
// comparison yet.
func summaryAnomaly(run *analyticsRun, unit anomalyUnit, f anomalyFindings) string {
	switch f.status {
	case anomalyStatusLittle:
		return anomalySpent(run, f) + " " + anomalyLittleHistory(run, unit, f)
	case anomalyStatusNone:
		head := "Không thấy gì bất thường."
		if run.windows.whole.Partial {
			head = "Chưa thấy gì bất thường."
		}
		return head + " " + anomalyAgainstUsual(run, unit, f)
	}
	s := anomalyFindingSentences(run, unit, f)
	switch len(s) {
	case 0:
		return anomalySpent(run, f)
	case 1:
		return s[0].head
	}
	return s[0].head + " " + s[1].follow
}

// anomalySentence is one finding, worded to open the reply (head, naming
// the period) or to follow another finding (follow).
type anomalySentence struct{ head, follow string }

// anomalyFindingSentences orders findings by how much they explain: the
// period's whole spending, then one outsized expense, then a Category far
// above its usual, a Category with no history, the number of expenses, and
// an outsized income.
func anomalyFindingSentences(run *analyticsRun, unit anomalyUnit, f anomalyFindings) []anomalySentence {
	var out []anomalySentence
	add := func(head, follow string) { out = append(out, anomalySentence{head: head, follow: follow}) }
	m := func(x int64) string { return money(run, x) }
	baseline := anomalyBaselineLabel(unit, run.windows.monthly)

	if f.totalSpike {
		add(fmt.Sprintf("%s chi %s, gấp %s lần %s (%s).", lead(run), m(f.total), anomalyRatio(f.total, *f.typical),
			anomalyTypicalLabel(run, unit, f.weekday), m(*f.typical)), "")
	}
	if len(f.large) > 0 {
		l := f.large[0]
		like := "một khoản chi thường"
		if l.ofCategory {
			like = "một khoản " + l.row.CategoryName + " thường"
		}
		s := fmt.Sprintf("Khoản %s cho %s ngày %s gấp %s lần %s (%s).", m(l.row.Amount), l.row.CategoryName,
			shortDate(l.row.OccurredAt.In(common.AppLocation)), anomalyRatio(l.row.Amount, l.typical), like, m(l.typical))
		add(s, s)
	}
	for _, c := range f.categories {
		if c.typical == nil {
			continue
		}
		usual := anomalyTypicalLabel(run, unit, false)
		ratio := anomalyRatio(c.amount, *c.typical)
		add(fmt.Sprintf("%s chi cho %s %s, gấp %s lần %s (%s).", lead(run), c.name, m(c.amount), ratio, usual, m(*c.typical)),
			fmt.Sprintf("%s: %s, gấp %s lần %s (%s).", c.name, m(c.amount), ratio, usual, m(*c.typical)))
		break
	}
	for _, c := range f.categories {
		if c.typical != nil {
			continue
		}
		add(fmt.Sprintf("%s chi cho %s %s, %s không có khoản nào.", lead(run), c.name, m(c.amount), baseline),
			fmt.Sprintf("%s: %s, %s không có khoản nào.", c.name, m(c.amount), baseline))
		break
	}
	if f.countSpike {
		add(fmt.Sprintf("%s có %d khoản chi, thường %d khoản.", lead(run), f.count, *f.typicalCount),
			fmt.Sprintf("Có %d khoản chi, thường %d khoản.", f.count, *f.typicalCount))
	}
	if len(f.income) > 0 {
		r := f.income[0]
		s := fmt.Sprintf("Có khoản thu %s từ %s ngày %s, lớn hơn mọi khoản thu trong %s.", m(r.Amount), r.CategoryName,
			shortDate(r.OccurredAt.In(common.AppLocation)), baseline)
		add(s, s)
	}
	return out
}

// anomalySpent states the period's spending: "Tính đến giờ, hôm nay (21/10)
// chi 350.000đ." or "Hôm nay (21/10) chưa có khoản chi nào."
func anomalySpent(run *analyticsRun, f anomalyFindings) string {
	if f.total > 0 {
		return fmt.Sprintf("%s chi %s.", lead(run), money(run, f.total))
	}
	return fmt.Sprintf("%s %s có khoản chi nào.", periodLabel(run.q.Period, run.windows, true), anomalyNotYet(run))
}

func anomalyAgainstUsual(run *analyticsRun, unit anomalyUnit, f anomalyFindings) string {
	usual := fmt.Sprintf("%s là %s.", anomalyTypicalLabel(run, unit, f.weekday), money(run, *f.typical))
	if f.total > 0 {
		return fmt.Sprintf("%s chi %s, %s", lead(run), money(run, f.total), usual)
	}
	return fmt.Sprintf("%s %s có khoản chi nào, %s", periodLabel(run.q.Period, run.windows, true), anomalyNotYet(run), usual)
}

func anomalyLittleHistory(run *analyticsRun, unit anomalyUnit, f anomalyFindings) string {
	baseline := anomalyBaselineLabel(unit, run.windows.monthly)
	if f.history == 0 {
		return fmt.Sprintf("Chưa đủ lịch sử để so: %s chưa có khoản chi nào.", baseline)
	}
	return fmt.Sprintf("Chưa đủ lịch sử để so: %s mới có %d %s có chi tiêu, cần ít nhất %d.",
		baseline, f.history, anomalyUnitWord(unit, run.windows.monthly), unit.minHistory)
}

// anomalyNotYet: a period still in progress has had no spending "yet".
func anomalyNotYet(run *analyticsRun) string {
	if run.windows.whole.Partial {
		return "chưa"
	}
	return "không"
}

// anomalyTypicalLabel names the yardstick in running text: "mức thường
// ngày", "mức thường vào Thứ Bảy", "mức thường mỗi tuần", "mức thường mỗi
// tháng".
func anomalyTypicalLabel(run *analyticsRun, unit anomalyUnit, weekday bool) string {
	switch unit.name {
	case anomalyUnitWeek.name:
		return "mức thường mỗi tuần"
	case anomalyUnitCycle.name:
		return "mức thường mỗi " + cycleUnit(run.windows.monthly)
	}
	if weekday {
		day := run.windows.whole.Start.In(common.AppLocation).Weekday()
		return "mức thường vào " + weekdayLabels[mondayIndex(day)]
	}
	return "mức thường ngày"
}

// anomalyBaselineLabel names the history compared with: "8 tuần trước đó",
// "6 tháng trước đó".
func anomalyBaselineLabel(unit anomalyUnit, monthly bool) string {
	switch unit.name {
	case anomalyUnitCycle.name:
		return fmt.Sprintf("%d %s trước đó", common.AnomalyBaselineCycles, cycleUnit(monthly))
	case anomalyUnitWeek.name:
		return fmt.Sprintf("%d tuần trước đó", common.AnomalyBaselineWeeks)
	}
	return fmt.Sprintf("%d tuần trước đó", common.AnomalyBaselineDays/common.AnalyticsDaysPerWeek)
}

func anomalyUnitWord(unit anomalyUnit, monthly bool) string {
	switch unit.name {
	case anomalyUnitCycle.name:
		return cycleUnit(monthly)
	case anomalyUnitWeek.name:
		return "tuần"
	}
	return "ngày"
}

// anomalyRatio is amount ÷ usual to one decimal, Vietnamese style: "4,2",
// or "5" when whole. Integer half-up; display only, never an amount.
func anomalyRatio(amount, usual int64) string {
	if usual <= 0 {
		return "0"
	}
	tenths := divRoundHalfUp(amount*anomalyRatioTenths, usual)
	if tenths%anomalyRatioTenths == 0 {
		return fmt.Sprintf("%d", tenths/anomalyRatioTenths)
	}
	return fmt.Sprintf("%d,%d", tenths/anomalyRatioTenths, tenths%anomalyRatioTenths)
}
