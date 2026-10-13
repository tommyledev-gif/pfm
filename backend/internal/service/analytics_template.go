package service

import (
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Every user-facing sentence an analytics answer can contain. Summaries are
// only ever built here, from computed figures — never from model output
// (plan.md BR-11). Vietnamese, per the product's copy rule.

const (
	labelOther     = "Khác"
	shortDateFmt   = "02/01"
	listSeparator  = ", "
	unitMonth      = "tháng"
	unitCycle      = "kỳ"
	noticeCodeCur  = "other_currencies_present"
	noticeCodePrev = "no_previous_data"
	noticeCodeFew  = "fewer_cycles_than_requested"
	noticeCodeWeek = "period_too_short"
)

var (
	weekdayKeys   = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
	weekdayLabels = []string{"Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"}
)

func cycleUnit(monthly bool) string {
	if monthly {
		return unitMonth
	}
	return unitCycle
}

// cycleLabel names one cycle in a series: "T9/26" for calendar months,
// its start date otherwise.
func cycleLabel(w model.AnalyticsWindow, monthly bool, loc *time.Location) string {
	start := w.Start.In(loc)
	if monthly {
		return fmt.Sprintf("T%d/%02d", int(start.Month()), start.Year()%100)
	}
	return shortDate(start)
}

func shortDate(t time.Time) string { return t.Format(shortDateFmt) }

func periodResponse(q model.AnalyticsQuery, w analyticsWindows, loc *time.Location) dto.AnalyticsPeriodResponse {
	return dto.AnalyticsPeriodResponse{
		Key:      string(q.Period),
		Label:    periodLabel(q.Period, w, false),
		From:     w.whole.Start,
		To:       w.whole.End,
		FromDate: w.whole.Start.In(loc).Format(common.DateOnlyLayout),
		ToDate:   w.whole.End.Add(-reportBoundResolution).In(loc).Format(common.DateOnlyLayout),
		Partial:  w.whole.Partial,
	}
}

func money(run *analyticsRun, amount int64) string { return common.FormatCentsVI(amount, run.currency) }

func isIncome(run *analyticsRun) bool { return run.q.TxType == string(model.TransactionTypeIncome) }

// forCategories is " cho Ăn uống, Cà phê" when the question named Categories.
func forCategories(run *analyticsRun) string {
	if len(run.categoryNames) == 0 {
		return ""
	}
	return " cho " + strings.Join(run.categoryNames, listSeparator)
}

func summaryEmpty(run *analyticsRun) string {
	kind := "chi"
	if isIncome(run) {
		kind = "thu"
	}
	threshold := ""
	if run.q.AmountMin != nil {
		threshold = " từ " + money(run, *run.q.AmountMin) + " trở lên"
	}
	return fmt.Sprintf("Không có khoản %s nào%s%s %s.", kind, threshold, forCategories(run), periodIn(run))
}

func summarySum(run *analyticsRun, total int64) string {
	if isIncome(run) {
		return fmt.Sprintf("%s bạn đã nhận %s thu nhập%s.", lead(run), money(run, total), forCategories(run))
	}
	return fmt.Sprintf("%s bạn đã chi %s%s.", lead(run), money(run, total), forCategories(run))
}

// summaryTopCategory follows a total with what it went on: the largest
// Category ("Ăn uống cao nhất: 150.000 ₫."), or the only one. items is
// amount-descending and never empty.
func summaryTopCategory(run *analyticsRun, items []dto.AnalyticsChartItem) string {
	if len(items) == 1 {
		if isIncome(run) {
			return fmt.Sprintf("Tất cả từ %s.", items[0].Label)
		}
		return fmt.Sprintf("Tất cả cho %s.", items[0].Label)
	}
	return fmt.Sprintf("%s cao nhất: %s.", items[0].Label, money(run, items[0].Amount))
}

func summaryCompare(run *analyticsRun, c *dto.AnalyticsCompare) string {
	subject := "Chi tiêu"
	if isIncome(run) {
		subject = "Thu nhập"
	} else if len(run.categoryNames) > 0 {
		subject = "Chi" + forCategories(run)
	}
	change := ""
	if c.ChangePct != nil {
		switch pct := *c.ChangePct; {
		case pct > 0:
			change = fmt.Sprintf(" (tăng %d%%)", pct)
		case pct < 0:
			change = fmt.Sprintf(" (giảm %d%%)", -pct)
		default:
			change = " (không đổi)"
		}
	}
	return fmt.Sprintf("%s %s: %s, %s: %s%s.", subject, c.CurrentLabel, money(run, c.Current), c.PreviousLabel, money(run, c.Previous), change)
}

func summarySeries(run *analyticsRun, items []dto.AnalyticsChartItem) string {
	var total int64
	for _, item := range items {
		total += item.Amount
	}
	verb := "chi"
	if isIncome(run) {
		verb = "nhận"
	}
	unit := cycleUnit(run.windows.monthly)
	avg := divRoundHalfUp(total, int64(len(items)))
	return fmt.Sprintf("Trung bình mỗi %s bạn %s %s%s, qua %d %s gần nhất.", unit, verb, money(run, avg), forCategories(run), len(items), unit)
}

func summaryBreakdown(run *analyticsRun, top dto.AnalyticsChartItem, total int64) string {
	kind := "chi"
	if isIncome(run) {
		kind = "thu"
	}
	pct := divRoundHalfUp(top.Amount*common.AnalyticsPercentScale, total)
	return fmt.Sprintf("%s, %s chiếm nhiều nhất: %s (%d%% tổng %s %s).", lead(run), top.Label, money(run, top.Amount), pct, kind, money(run, total))
}

func summaryTop(run *analyticsRun, rows []dto.AnalyticsTxRow, matched int64, loc *time.Location) string {
	label := periodLabel(run.q.Period, run.windows, false)
	if run.q.Metric == model.AnalyticsMetricMaxTx {
		r := rows[0]
		return fmt.Sprintf("Khoản chi lớn nhất %s: %s cho %s ngày %s.", label, money(run, r.Amount), r.CategoryName, shortDate(r.OccurredAt.In(loc)))
	}
	if run.q.AmountMin != nil {
		s := fmt.Sprintf("Có %d khoản chi từ %s trở lên trong %s.", matched, money(run, *run.q.AmountMin), label)
		if matched > int64(len(rows)) {
			s += fmt.Sprintf(" Đang hiện %d khoản lớn nhất.", len(rows))
		}
		return s
	}
	s := fmt.Sprintf("%d khoản chi lớn nhất %s%s.", len(rows), label, forCategories(run))
	if matched > int64(len(rows)) {
		s += fmt.Sprintf(" Tổng cộng có %d khoản chi.", matched)
	}
	return s
}

func summaryAvgDaily(run *analyticsRun, avg int64, days int) string {
	return fmt.Sprintf("%s bạn chi trung bình %s mỗi ngày%s, tính trên %d ngày có chi tiêu.", lead(run), money(run, avg), forCategories(run), days)
}

func summaryWeekday(run *analyticsRun, top dto.AnalyticsChartItem) string {
	return fmt.Sprintf("%s bạn chi nhiều nhất vào %s (%s).", lead(run), top.Label, money(run, top.Amount))
}

func summaryWalletBreakdown(run *analyticsRun, top dto.AnalyticsChartItem) string {
	return fmt.Sprintf("%s bạn chi nhiều nhất từ ví %s: %s.", lead(run), top.Label, money(run, top.Amount))
}

func summaryNoBudgets() string { return "Bạn chưa có ngân sách nào cho kỳ này." }

func summaryBudgets(run *analyticsRun, items []dto.AnalyticsBudgetItem) string {
	var remaining int64
	exceeded := 0
	for _, item := range items {
		if item.Exceeded {
			exceeded++
		} else {
			remaining += item.Remaining
		}
	}
	s := fmt.Sprintf("Bạn còn %s trong %d ngân sách.", money(run, remaining), len(items))
	if exceeded > 0 {
		s += fmt.Sprintf(" %d ngân sách đã vượt.", exceeded)
	}
	return s
}

func noticeOtherCurrencies(currencies []string) dto.AnalyticsNotice {
	return dto.AnalyticsNotice{Code: noticeCodeCur, Message: "Chưa tính các khoản bằng " + strings.Join(currencies, listSeparator) + "."}
}

func noticeNoPreviousData() dto.AnalyticsNotice {
	return dto.AnalyticsNotice{Code: noticeCodePrev, Message: "Kỳ trước không có dữ liệu nên không tính được phần trăm thay đổi."}
}

func noticeFewerCycles(n int, monthly bool) dto.AnalyticsNotice {
	return dto.AnalyticsNotice{Code: noticeCodeFew, Message: fmt.Sprintf("Mới có dữ liệu cho %d %s.", n, cycleUnit(monthly))}
}

func noticePeriodTooShort() dto.AnalyticsNotice {
	return dto.AnalyticsNotice{Code: noticeCodeWeek, Message: "Khoảng thời gian ngắn hơn một tuần nên chưa thấy rõ thói quen."}
}

func upperFirst(s string) string {
	r, size := utf8.DecodeRuneInString(s)
	if r == utf8.RuneError {
		return s
	}
	return string(unicode.ToUpper(r)) + s[size:]
}
