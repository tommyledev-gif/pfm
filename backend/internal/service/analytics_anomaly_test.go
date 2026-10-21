package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// analyticsNow is Wednesday 14/10/2026 10:00 local, so "today" is 14/10.

var (
	anomFood  = uuid.MustParse("aaaaaaaa-0000-4000-8000-000000000001")
	anomMove  = uuid.MustParse("aaaaaaaa-0000-4000-8000-000000000002")
	anomShop  = uuid.MustParse("aaaaaaaa-0000-4000-8000-000000000003")
	anomBonus = uuid.MustParse("aaaaaaaa-0000-4000-8000-000000000004")
)

func localAt(day, hour, minute int) time.Time {
	return time.Date(2026, time.October, day, hour, minute, 0, 0, common.AppLocation)
}

// tx is one row in đồng at a local instant (stored UTC, like the DB).
func tx(category uuid.UUID, name string, vnd int64, at time.Time) model.AnalyticsExpense {
	return model.AnalyticsExpense{
		ID: uuid.New(), Amount: vnd * common.VNDToCentsFactor, OccurredAt: at.UTC(),
		CategoryID: category, CategoryName: name, WalletName: "Tiền mặt",
	}
}

// history adds one expense a day at noon for the n days before 14/10;
// amount(k) is the đồng amount k days back.
func history(n int, category uuid.UUID, name string, amount func(k int) int64) []model.AnalyticsExpense {
	var out []model.AnalyticsExpense
	for k := 1; k <= n; k++ {
		out = append(out, tx(category, name, amount(k), localAt(14, 12, 0).AddDate(0, 0, -k)))
	}
	return out
}

func flat(vnd int64) func(int) int64 { return func(int) int64 { return vnd } }

func todayAnomaly() dto.AnalyticsQueryRequest {
	return dto.AnalyticsQueryRequest{Metric: "anomaly", Period: "custom", From: "2026-10-14", To: "2026-10-14"}
}

func askAnomaly(t *testing.T, f *analyticsFixture, req dto.AnalyticsQueryRequest, expenses, incomes []model.AnalyticsExpense) *dto.AnalyticsAnswerResponse {
	t.Helper()
	f.analytics.txByType = map[string][]model.AnalyticsExpense{"expense": expenses, "income": incomes}
	answer, err := f.svc.Answer(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if answer.Chart.Type != "anomaly" || answer.Chart.Anomaly == nil {
		t.Fatalf("expected an anomaly chart, got %+v", answer.Chart)
	}
	return answer
}

// A day far above the usual: the total, the expense behind it and the
// Category it went to, which had no spending in 8 weeks.
func TestAnomaly_SpikeToday(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := append(history(30, anomFood, "Ăn uống", flat(100_000)),
		tx(anomFood, "Ăn uống", 100_000, localAt(14, 8, 0)),
		tx(anomShop, "Mua sắm", 900_000, localAt(14, 9, 0)),
	)
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)
	a := answer.Chart.Anomaly

	if a.Status != anomalyStatusFound || !a.TotalSpike || a.Total != 1_000_000*common.VNDToCentsFactor {
		t.Fatalf("expected a total spike of 1.000.000đ, got %+v", a)
	}
	want := "Tính đến giờ, hôm nay (14/10) chi 1.000.000đ, gấp 10 lần mức thường ngày (100.000đ). " +
		"Khoản 900.000đ cho Mua sắm ngày 14/10 gấp 9 lần một khoản chi thường (100.000đ)."
	if answer.Summary != want {
		t.Fatalf("summary:\n got %q\nwant %q", answer.Summary, want)
	}
	if len(a.Categories) != 1 || a.Categories[0].CategoryName != "Mua sắm" || a.Categories[0].Typical != nil {
		t.Fatalf("expected Mua sắm as a new Category, got %+v", a.Categories)
	}
	if len(answer.Chart.Rows) != 1 || answer.Chart.Rows[0].Amount != 900_000*common.VNDToCentsFactor {
		t.Fatalf("expected the 900.000đ expense listed, got %+v", answer.Chart.Rows)
	}
	if answer.Chart.Compare == nil || answer.Chart.Compare.Previous != 100_000*common.VNDToCentsFactor || answer.Chart.Compare.ChangePct != nil {
		t.Fatalf("expected today against a usual 100.000đ day, no percentage, got %+v", answer.Chart.Compare)
	}
	if answer.TxCount != 2 {
		t.Fatalf("tx_count = %d, want 2", answer.TxCount)
	}

	labels := []string{}
	for _, c := range answer.FollowUps {
		labels = append(labels, c.Label)
	}
	if strings.Join(labels, "|") != "Các khoản Mua sắm|Tiền đi đâu?|Hôm qua có gì bất thường?" {
		t.Fatalf("follow-ups = %v", labels)
	}
	yesterday := answer.FollowUps[2].Query
	if yesterday.Metric != "anomaly" || yesterday.From != "2026-10-13" || yesterday.To != "2026-10-13" {
		t.Fatalf("yesterday chip = %+v", yesterday)
	}
	if shop := answer.FollowUps[0].Query; shop.Metric != "top_n" || shop.From != "2026-10-14" || len(shop.CategoryIDs) != 1 || shop.CategoryIDs[0] != anomShop {
		t.Fatalf("category chip = %+v", shop)
	}
}

func TestAnomaly_NothingUnusual(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := append(history(30, anomFood, "Ăn uống", flat(200_000)), tx(anomFood, "Ăn uống", 150_000, localAt(14, 8, 0)))
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)

	if answer.Chart.Anomaly.Status != anomalyStatusNone {
		t.Fatalf("expected nothing unusual, got %+v", answer.Chart.Anomaly)
	}
	want := "Chưa thấy gì bất thường. Tính đến giờ, hôm nay (14/10) chi 150.000đ, mức thường ngày là 200.000đ."
	if answer.Summary != want {
		t.Fatalf("summary:\n got %q\nwant %q", answer.Summary, want)
	}
}

func TestAnomaly_TooLittleHistory(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := append(history(4, anomFood, "Ăn uống", flat(50_000)), tx(anomShop, "Mua sắm", 2_000_000, localAt(14, 8, 0)))
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)
	a := answer.Chart.Anomaly

	if a.Status != anomalyStatusLittle || a.HistorySamples != 4 || a.Typical != nil || answer.Chart.Compare != nil {
		t.Fatalf("expected too little history and no comparison, got %+v", a)
	}
	want := "Tính đến giờ, hôm nay (14/10) chi 2.000.000đ. Chưa đủ lịch sử để so: 8 tuần trước đó mới có 4 ngày có chi tiêu, cần ít nhất 10."
	if answer.Summary != want {
		t.Fatalf("summary:\n got %q\nwant %q", answer.Summary, want)
	}
}

// The day's total is below a usual day, yet one expense is six times a
// usual one of its Category.
func TestAnomaly_LargeSingleExpense(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := append(history(30, anomFood, "Ăn uống", flat(50_000)), history(30, anomFood, "Ăn uống", flat(50_000))...)
	expenses = append(expenses, history(30, anomMove, "Di chuyển", flat(300_000))...)
	expenses = append(expenses, tx(anomFood, "Ăn uống", 320_000, localAt(14, 9, 30)))
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)
	a := answer.Chart.Anomaly

	if a.TotalSpike || a.Status != anomalyStatusFound {
		t.Fatalf("expected no total spike but a finding, got %+v", a)
	}
	want := "Khoản 320.000đ cho Ăn uống ngày 14/10 gấp 6,4 lần một khoản Ăn uống thường (50.000đ). " +
		"Ăn uống: 320.000đ, gấp 3,2 lần mức thường ngày (100.000đ)."
	if answer.Summary != want {
		t.Fatalf("summary:\n got %q\nwant %q", answer.Summary, want)
	}
	if len(answer.Chart.Rows) != 1 {
		t.Fatalf("expected the large expense listed, got %+v", answer.Chart.Rows)
	}
}

// Day bounds are local midnights: 23:30 on 13/10 is yesterday's, 00:30 on
// 14/10 (17:30 UTC on 13/10) is today's.
func TestAnomaly_TimezoneDayBoundary(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := append(history(30, anomFood, "Ăn uống", flat(100_000)),
		tx(anomShop, "Mua sắm", 5_000_000, localAt(13, 23, 30)),
		tx(anomFood, "Ăn uống", 100_000, localAt(14, 0, 30)),
	)
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)
	a := answer.Chart.Anomaly

	if a.Total != 100_000*common.VNDToCentsFactor || a.Count != 1 {
		t.Fatalf("today should hold only the 00:30 expense, got total %d count %d", a.Total, a.Count)
	}
	if a.Status != anomalyStatusNone {
		t.Fatalf("yesterday's 5.000.000đ must not make today unusual, got %+v", a)
	}
}

// A Wednesday is judged against usual Wednesdays when those run higher.
func TestAnomaly_UsualWeekday(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := history(30, anomFood, "Ăn uống", func(k int) int64 {
		if k%7 == 0 {
			return 500_000
		}
		return 100_000
	})
	expenses = append(expenses, tx(anomFood, "Ăn uống", 300_000, localAt(14, 8, 0)), tx(anomFood, "Ăn uống", 300_000, localAt(14, 9, 0)))
	answer := askAnomaly(t, f, todayAnomaly(), expenses, nil)

	if answer.Chart.Anomaly.Status != anomalyStatusNone {
		t.Fatalf("expected nothing unusual against a usual Wednesday, got %+v", answer.Chart.Anomaly)
	}
	if !strings.Contains(answer.Summary, "mức thường vào Thứ Tư là 500.000đ") {
		t.Fatalf("summary should name the usual Wednesday: %q", answer.Summary)
	}
}

func TestAnomaly_ThisWeek(t *testing.T) {
	f := newAnalyticsFixture(t)
	expenses := history(60, anomFood, "Ăn uống", flat(100_000))
	for day := 12; day <= 14; day++ { // Monday 12/10 to today
		expenses = append(expenses, tx(anomShop, "Mua sắm", 1_000_000, localAt(day, 9, 0)))
	}
	answer := askAnomaly(t, f, dto.AnalyticsQueryRequest{Metric: "anomaly", Period: "this_week"}, expenses, nil)

	if !strings.HasPrefix(answer.Summary, "Tính đến hôm nay, tuần này chi 3.200.000đ, gấp 4,6 lần mức thường mỗi tuần (700.000đ).") {
		t.Fatalf("summary: %q", answer.Summary)
	}
	if answer.FollowUps[len(answer.FollowUps)-1].Label != "Tháng này có gì bất thường?" {
		t.Fatalf("follow-ups = %+v", answer.FollowUps)
	}
}

func TestAnomaly_LargerIncome(t *testing.T) {
	f := newAnalyticsFixture(t)
	incomes := []model.AnalyticsExpense{
		tx(anomBonus, "Lương", 10_000_000, localAt(1, 9, 0).AddDate(0, -1, 0)),
		tx(anomBonus, "Lương", 10_000_000, localAt(1, 9, 0)),
		tx(anomBonus, "Lương", 500_000, localAt(5, 9, 0)),
		tx(anomBonus, "Thưởng", 25_000_000, localAt(14, 9, 0)),
	}
	answer := askAnomaly(t, f, todayAnomaly(), history(30, anomFood, "Ăn uống", flat(100_000)), incomes)
	a := answer.Chart.Anomaly

	if a.Status != anomalyStatusFound || len(a.Income) != 1 {
		t.Fatalf("expected the 25.000.000đ income, got %+v", a)
	}
	want := "Có khoản thu 25.000.000đ từ Thưởng ngày 14/10, lớn hơn mọi khoản thu trong 8 tuần trước đó."
	if answer.Summary != want {
		t.Fatalf("summary:\n got %q\nwant %q", answer.Summary, want)
	}
}

func TestAnomaly_PeriodRules(t *testing.T) {
	f := newAnalyticsFixture(t)
	for _, req := range []dto.AnalyticsQueryRequest{
		{Metric: "anomaly", Period: "custom", From: "2026-10-01", To: "2026-10-05"},
		{Metric: "anomaly", Period: "last_30_days"},
		{Metric: "anomaly", Period: "last_6_cycles"},
	} {
		_, err := f.svc.Answer(context.Background(), f.userID, req)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
			t.Errorf("%+v: expected INVALID_INPUT, got %v", req, err)
		}
	}
	f.analytics.txByType = map[string][]model.AnalyticsExpense{}
	if _, err := f.svc.Answer(context.Background(), f.userID, dto.AnalyticsQueryRequest{Metric: "anomaly", Period: "last_cycle"}); err != nil {
		t.Fatalf("last cycle: %v", err)
	}
}

// When the listing hits its cap, the sample holding the oldest row may be
// incomplete; it and everything older are dropped.
func TestAnomaly_KeepFromDropsPartialSamples(t *testing.T) {
	w := func(day int) model.AnalyticsWindow {
		return model.AnalyticsWindow{Start: localAt(day, 0, 0).UTC(), End: localAt(day+1, 0, 0).UTC()}
	}
	scope := anomalyScope{period: w(14), baseline: []model.AnalyticsWindow{w(11), w(12), w(13)}}
	rows := []model.AnalyticsExpense{tx(anomFood, "Ăn uống", 1, localAt(14, 1, 0)), tx(anomFood, "Ăn uống", 1, localAt(12, 5, 0))}
	if got := scope.anomalyKeepFrom(rows, 3); got != 0 {
		t.Fatalf("under the cap keeps everything, got %d", got)
	}
	if got := scope.anomalyKeepFrom(rows, 2); got != 2 {
		t.Fatalf("at the cap keeps only samples after 12/10, got %d", got)
	}
}

func TestAnomaly_Stats(t *testing.T) {
	if m := medianOf([]int64{5, 1, 3}); m != 3 {
		t.Errorf("median odd = %d", m)
	}
	if m := medianOf([]int64{4, 1, 3, 2}); m != 3 { // (2+3)/2 half-up
		t.Errorf("median even = %d", m)
	}
	if p := p90Of([]int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}); p != 9 {
		t.Errorf("p90 = %d", p)
	}
	for _, c := range []struct {
		a, b int64
		want string
	}{{1000, 100, "10"}, {320, 50, "6,4"}, {3000, 700, "4,3"}, {1, 0, "0"}} {
		if got := anomalyRatio(c.a, c.b); got != c.want {
			t.Errorf("ratio(%d, %d) = %q, want %q", c.a, c.b, got, c.want)
		}
	}
}
