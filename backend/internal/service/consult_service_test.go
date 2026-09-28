package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

type consultFixture struct {
	*analyticsFixture
	client *fakeConsultClient
	logs   *fakeIntentLogRepo
	tokens *ConsultTokenBudget
	svc    *ConsultService
	food   *model.Category
}

func newConsultFixture(t *testing.T) *consultFixture {
	t.Helper()
	a := newAnalyticsFixture(t)
	food, err := a.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: a.userID, Name: "Ăn uống", Type: "expense"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	f := &consultFixture{
		analyticsFixture: a, client: &fakeConsultClient{}, logs: &fakeIntentLogRepo{},
		tokens: NewConsultTokenBudget(common.ConsultTokenBudgetPerMinute, common.ConsultTokenBudgetWindow), food: food,
	}
	f.svc = NewConsultService(a.svc, a.analytics, a.wallets, a.categories, f.client, f.tokens, f.logs, a.resolver, zap.NewNop())
	return f
}

func conf(v float64) *float64 { return &v }

func foodQuery(f *consultFixture, confidence float64) *AIConsultParse {
	return &AIConsultParse{
		Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull, Metric: "sum", Period: "this_cycle",
		CategoryIDs: []uuid.UUID{f.food.ID}, CategoryConfidence: conf(confidence),
		NormalizedText: "thang nay tieu bao nhieu cho an uong", PromptTokens: 150, CompletionTokens: 30, CachedTokens: 100,
	}
}

func ask(t *testing.T, f *consultFixture, msg string) *dto.ConsultResponse {
	t.Helper()
	reply, err := f.svc.Consult(context.Background(), f.userID, dto.ConsultRequest{Message: msg})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return reply
}

// S-AIQ-20/S-AIQ-24: a confident, complete question is answered; a medium
// confidence Category match adds the banner. The log row keeps tokens.
func TestConsult_AnswersAndBannersMediumConfidence(t *testing.T) {
	f := newConsultFixture(t)
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry {
		return []model.ReportCategoryEntry{{CategoryID: f.food.ID, CategoryName: "Ăn uống", Type: "expense", Currency: "VND", Amount: 500}}
	}
	f.analytics.count = 1

	f.client.parse = foodQuery(f, 0.9)
	reply := ask(t, f, "tháng này tiêu bao nhiêu cho ăn uống")
	if reply.Kind != string(model.ConsultKindAnswer) || reply.Answer == nil || *reply.Answer.Chart.Value != 500 {
		t.Fatalf("expected an answer of 500, got %+v", reply)
	}
	if len(reply.BannerCategories) != 0 {
		t.Fatalf("high confidence must not show a banner")
	}

	f.client.parse = foodQuery(f, 0.6)
	reply = ask(t, f, "thang nay tieu bn cho an")
	if len(reply.BannerCategories) != 1 || reply.BannerCategories[0].Name != "Ăn uống" {
		t.Fatalf("expected banner naming the Category, got %+v", reply.BannerCategories)
	}

	row := f.logs.rows[0]
	if row.Outcome != model.IntentOutcomeAnswered || *row.CachedTokens != 100 || row.RawText == "" {
		t.Fatalf("unexpected log row %+v", row)
	}
}

// S-AIQ-26: low confidence → no figures, pick a Category.
func TestConsult_LowConfidenceAsksForCategory(t *testing.T) {
	f := newConsultFixture(t)
	f.client.parse = foodQuery(f, 0.3)
	reply := ask(t, f, "tốn bao nhiêu cho vụ đó")
	if reply.Kind != string(model.ConsultKindClarifyCategory) || reply.Answer != nil {
		t.Fatalf("expected a clarification without figures, got %+v", reply)
	}
	if len(reply.CategoryChoices) == 0 || reply.PendingQuery == nil || len(reply.PendingQuery.CategoryIDs) != 0 {
		t.Fatalf("expected choices and a pending query without Categories, got %+v", reply)
	}
}

// S-AIQ-27: partial coverage is never answered from the covered part.
func TestConsult_PartialCoverageIsNotAnswered(t *testing.T) {
	f := newConsultFixture(t)
	p := foodQuery(f, 0.9)
	p.Coverage = "partial"
	f.client.parse = p
	if reply := ask(t, f, "tháng này tiêu bao nhiêu cho ăn uống ở quận 1"); reply.Answer != nil || reply.Kind != string(model.ConsultKindUnsupported) {
		t.Fatalf("expected unsupported without figures, got %+v", reply)
	}
}

// S-AIQ-28…31: non-query kinds never produce figures.
func TestConsult_NonQueryKinds(t *testing.T) {
	cases := map[string]model.ConsultKind{
		model.ParseKindEvaluate:        model.ConsultKindComingLater,
		model.ParseKindScenario:        model.ConsultKindComingLater,
		model.ParseKindNeedsContext:    model.ConsultKindNeedsContext,
		model.ParseKindTransactionLike: model.ConsultKindSwitchMode,
		model.ParseKindUnsupported:     model.ConsultKindUnsupported,
	}
	for parseKind, want := range cases {
		f := newConsultFixture(t)
		f.client.parse = &AIConsultParse{Kind: parseKind}
		reply := ask(t, f, "câu hỏi")
		if reply.Kind != string(want) || reply.Answer != nil {
			t.Fatalf("%s: got kind %s answer %v", parseKind, reply.Kind, reply.Answer)
		}
		if parseKind == model.ParseKindTransactionLike && !reply.SwitchToRecording {
			t.Fatalf("transaction-like must offer switching to recording")
		}
	}
}

// S-AIQ-40/S-AIQ-41 + plan F13: interpreter failure or an exhausted token
// budget degrades (200, chips), and an exhausted budget skips the call.
func TestConsult_Degrades(t *testing.T) {
	f := newConsultFixture(t)
	f.client.err = errFakeUnavailable
	if reply := ask(t, f, "tháng này tiêu bao nhiêu"); reply.Kind != string(model.ConsultKindDegraded) || len(reply.Chips) == 0 {
		t.Fatalf("expected degraded reply with chips, got %+v", reply)
	}

	f = newConsultFixture(t)
	f.tokens.Record(common.ConsultTokenBudgetPerMinute)
	ask(t, f, "tháng này tiêu bao nhiêu")
	if f.client.calls != 0 {
		t.Fatalf("exhausted budget must not call the interpreter")
	}
}

// An unanswerable combination from the interpreter reads as "cannot
// answer", not a validation error, and is logged as an error outcome.
func TestConsult_InterpreterMistakeIsNotAValidationError(t *testing.T) {
	f := newConsultFixture(t)
	p := foodQuery(f, 0.9)
	p.Metric, p.Period = "series", "this_cycle"
	f.client.parse = p
	if reply := ask(t, f, "câu hỏi"); reply.Kind != string(model.ConsultKindUnsupported) {
		t.Fatalf("expected unsupported, got %+v", reply)
	}
	if f.logs.rows[0].Outcome != model.IntentOutcomeError {
		t.Fatalf("expected error outcome, got %s", f.logs.rows[0].Outcome)
	}
}

// S-AIQ-22: the threshold arrives in đồng and is compared in xu.
func TestConsult_AmountThresholdConvertsToXu(t *testing.T) {
	f := newConsultFixture(t)
	vnd := int64(50_000)
	f.client.parse = &AIConsultParse{Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull, Metric: "top_n", Period: "this_week", AmountMinVND: &vnd}
	ask(t, f, "chi trên 50k tuần này")
	if got := f.analytics.filters[0].AmountMin; got == nil || *got != 5_000_000 {
		t.Fatalf("amount_min = %v, want 5000000 xu", got)
	}
}

// US-07 EC: a log outage never fails the answer.
func TestConsult_LogFailureDoesNotFailAnswer(t *testing.T) {
	f := newConsultFixture(t)
	f.logs.insertErr = errFakeUnavailable
	f.client.parse = &AIConsultParse{Kind: model.ParseKindUnsupported}
	ask(t, f, "nên đầu tư gì")
}

// US-07: retention clears raw text at 30 days and rows at 12 months.
func TestIntentLogRetention_Cutoffs(t *testing.T) {
	logs := &fakeIntentLogRepo{}
	r := NewIntentLogRetention(logs, zap.NewNop())
	now := time.Date(2026, time.October, 14, 0, 0, 0, 0, time.UTC)
	r.now = func() time.Time { return now }
	r.Purge(context.Background())
	if !logs.cutoffs[0].Equal(now.Add(-common.IntentLogRawRetention)) || !logs.cutoffs[1].Equal(now.Add(-common.IntentLogRetention)) {
		t.Fatalf("unexpected cutoffs %v", logs.cutoffs)
	}
}

func TestConsultTokenBudget_SlidingWindow(t *testing.T) {
	b := NewConsultTokenBudget(100, time.Minute)
	clock := time.Date(2026, time.October, 14, 0, 0, 0, 0, time.UTC)
	b.now = func() time.Time { return clock }
	b.Record(100)
	if b.Allow() {
		t.Fatalf("budget should be exhausted")
	}
	clock = clock.Add(61 * time.Second)
	if !b.Allow() {
		t.Fatalf("budget should recover after the window")
	}
}
