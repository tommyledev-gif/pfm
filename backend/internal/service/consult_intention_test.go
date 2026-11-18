package service

import (
	"testing"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

type intentionConsultFixture struct {
	*consultFixture
	repo    *fakeIntentionRepo
	budgets *stubBudgets
}

func newIntentionConsultFixture(t *testing.T) *intentionConsultFixture {
	t.Helper()
	f := &intentionConsultFixture{consultFixture: newConsultFixture(t), repo: &fakeIntentionRepo{}, budgets: &stubBudgets{}}
	intentions := NewSpendingIntentionService(f.repo, f.wallets, f.categories, f.reports, f.budgets, f.resolver, zap.NewNop())
	f.svc.WithIntentions(intentions)
	f.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{
			{Type: "income", Currency: "VND", Amount: vnd(20_000_000)},
			{Type: "expense", Currency: "VND", Amount: vnd(17_000_000)},
		}
	}
	return f
}

// read puts a category on a reading unless it already has one, with the confidence given.
func (f *intentionConsultFixture) read(confidence float64, items ...AIIntentionParse) *AIConsultParse {
	for i := range items {
		if items[i].CategoryID == nil {
			items[i].CategoryID = &f.food.ID
			items[i].CategoryConfidence = conf(confidence)
		}
	}
	return &AIConsultParse{Kind: model.ParseKindIntention, Coverage: model.ParseCoverageFull, Intentions: items, NormalizedText: "x"}
}

func (f *intentionConsultFixture) ask(t *testing.T, msg string) *dto.ConsultResponse {
	t.Helper()
	return ask(t, f.consultFixture, msg)
}

// S-INT-01 / BR-01: the reading becomes a proposal whose figures the System computed; nothing is kept.
func TestConsultIntention_ProposesWithFigures(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Nước hoa", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(2_000_000)), Month: "2026-11"})

	reply := f.ask(t, "tháng sau mua nước hoa khoảng 2tr")
	if reply.Kind != string(model.ConsultKindIntention) || reply.Intentions == nil || len(reply.Intentions.Items) != 1 {
		t.Fatalf("expected one intention proposal, got %+v", reply)
	}
	draft := reply.Intentions.Items[0].Draft
	if draft.ID != nil || draft.Title != "Nước hoa" || draft.TargetMonth != "2026-11" {
		t.Fatalf("unexpected draft %+v", draft)
	}
	if draft.TotalAmount == nil || *draft.TotalAmount != vnd(2_000_000) {
		t.Fatalf("đồng must become xu once, got %v", draft.TotalAmount)
	}
	if draft.CategoryID == nil || draft.CategoryName != "Ăn uống" {
		t.Fatalf("a confident Category match is shown by name, got %v %q", draft.CategoryID, draft.CategoryName)
	}
	if a := draft.Assessment; a.Surplus == nil || *a.Surplus != vnd(3_000_000) || a.FitsSurplus == nil || !*a.FitsSurplus {
		t.Fatalf("figures must come from the records, got %+v", a)
	}
	if len(f.repo.rows) != 0 {
		t.Fatalf("a proposal must keep nothing, found %d rows", len(f.repo.rows))
	}
	if row := f.logs.rows[0]; row.Outcome != model.IntentOutcomeAnswered {
		t.Fatalf("logged outcome = %s", row.Outcome)
	}
}

// The case the feature exists for: braces on instalments, a perfume and a
// shower gel named together are weighed together, not one by one.
func TestConsultIntention_SeveralItemsAreWeighedTogether(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9,
		AIIntentionParse{Title: "Niềng răng", Kind: common.IntentionKindInstallment, MonthlyVND: ptr(int64(1_500_000)), Months: ptr(12)},
		AIIntentionParse{Title: "Nước hoa", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(1_000_000))},
		AIIntentionParse{Title: "Sữa tắm", Kind: common.IntentionKindOneTime},
	)
	reply := f.ask(t, "niềng răng trả góp 12 tháng 1tr5, mua nước hoa 1tr, mua sữa tắm")
	if reply.Intentions == nil || len(reply.Intentions.Items) != 3 {
		t.Fatalf("expected three proposals, got %+v", reply.Intentions)
	}
	byTitle := map[string]dto.IntentionAssessment{}
	for _, item := range reply.Intentions.Items {
		byTitle[item.Draft.Title] = item.Draft.Assessment
	}
	// Each one sees what the others take in the month: the perfume and the
	// instalment share this month's surplus of 3.000.000đ.
	if got := byTitle["Nước hoa"].OtherPlanned; got != vnd(1_500_000) {
		t.Fatalf("the perfume must see the instalment (1.500.000đ), got %d", got)
	}
	if got := byTitle["Niềng răng"].OtherPlanned; got != vnd(1_000_000) {
		t.Fatalf("the instalment must see the perfume (1.000.000đ), got %d", got)
	}
	if byTitle["Sữa tắm"].MonthlyBurden != nil || byTitle["Sữa tắm"].OtherPlanned != vnd(2_500_000) {
		t.Fatalf("a plan with no price still sees the others, got %+v", byTitle["Sữa tắm"])
	}

	if len(reply.Intentions.Portfolios) != 1 {
		t.Fatalf("expected one portfolio, got %+v", reply.Intentions.Portfolios)
	}
	p := reply.Intentions.Portfolios[0]
	if p.Count != 3 || len(p.Months) != 12 {
		t.Fatalf("three plans over twelve paying months expected, got count=%d months=%d", p.Count, len(p.Months))
	}
	first := p.Months[0]
	if first.Month != "2026-10" || first.Planned != vnd(2_500_000) || first.FitsSurplus == nil || !*first.FitsSurplus {
		t.Fatalf("this month plans 2.500.000đ against a 3.000.000đ surplus, got %+v", first)
	}
	if last := p.Months[len(p.Months)-1]; last.Planned != vnd(1_500_000) {
		t.Fatalf("later months carry only the instalment, got %+v", last)
	}
	if len(f.repo.rows) != 0 {
		t.Fatalf("proposals keep nothing")
	}
}

// What is already kept counts against the new proposals too.
func TestConsultIntention_KeptIntentionsCountAgainstNewOnes(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Nước hoa", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(2_000_000))})
	kept := NewSpendingIntentionService(f.repo, f.wallets, f.categories, f.reports, f.budgets, f.resolver, zap.NewNop())
	if _, _, err := kept.Create(t.Context(), f.userID, oneTime("Đã giữ", 1_500_000)); err != nil {
		t.Fatalf("seed: %v", err)
	}
	reply := f.ask(t, "mua nước hoa 2tr")
	draft := reply.Intentions.Items[0].Draft.Assessment
	if draft.OtherPlanned != vnd(1_500_000) || draft.FitsSurplus == nil || *draft.FitsSurplus || *draft.ShortSurplus != vnd(500_000) {
		t.Fatalf("2.000.000đ after 1.500.000đ kept leaves 1.500.000đ of the surplus: short by 500.000đ, got %+v", draft)
	}
	if p := reply.Intentions.Portfolios[0]; p.Count != 2 || p.Months[0].Planned != vnd(3_500_000) || *p.Months[0].FitsSurplus {
		t.Fatalf("together they are 3.500.000đ and do not fit the 3.000.000đ surplus, got %+v", p.Months[0])
	}
}

// BR-03 / S-INT-09: a weak Category match is dropped.
func TestConsultIntention_WeakCategoryIsDropped(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.4, AIIntentionParse{Title: "Cái này", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(500_000))})
	reply := f.ask(t, "mua cái này 500k")
	d := reply.Intentions.Items[0].Draft
	if d.CategoryID != nil || d.Assessment.Budget != nil {
		t.Fatalf("a weak match must leave no Category and no Budget line, got %+v", d)
	}
}

// S-INT-06: no price is still a card.
func TestConsultIntention_NoPriceStillProposes(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Sữa tắm", Kind: common.IntentionKindOneTime})
	d := f.ask(t, "mua sữa tắm").Intentions.Items[0].Draft
	if d.TotalAmount != nil || d.Assessment.MonthlyBurden != nil || d.Assessment.Surplus == nil {
		t.Fatalf("expected a card with no amount and the surplus still shown, got %+v", d)
	}
}

// EC-01: a month in the past becomes the current cycle, and the card says so.
func TestConsultIntention_PastMonthMovesToCurrent(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Giày", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(900_000)), Month: "2026-08"})
	item := f.ask(t, "tháng 8 mua giày").Intentions.Items[0]
	if !item.MonthMoved || item.Draft.TargetMonth != "2026-10" {
		t.Fatalf("expected the current month and a notice, got %+v", item)
	}
}

// EC-02: an instalment with no month count is shown incomplete, never invented.
func TestConsultIntention_InstalmentWithoutMonthsIsIncomplete(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Niềng răng", Kind: common.IntentionKindInstallment})
	d := f.ask(t, "niềng răng trả góp").Intentions.Items[0].Draft
	if d.Kind != common.IntentionKindInstallment || d.InstallmentMonths != nil || d.MonthlyAmount != nil {
		t.Fatalf("nothing may be invented, got %+v", d)
	}
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Niềng răng", Kind: common.IntentionKindInstallment, AmountVND: ptr(int64(18_000_000)), Months: ptr(100)})
	if d := f.ask(t, "niềng răng 100 tháng").Intentions.Items[0].Draft; d.InstallmentMonths != nil {
		t.Fatalf("an unusable month count must be left out, got %v", *d.InstallmentMonths)
	}
}

// EC-03 / EC-04: an item that cannot be read is skipped and counted; the rest
// still become proposals; with nothing readable there is no card.
func TestConsultIntention_UnreadableItemsAreSkipped(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9,
		AIIntentionParse{Title: "Siêu xe", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(common.IntentionAmountCapXu))},
		AIIntentionParse{Title: "   ", Kind: common.IntentionKindOneTime},
		AIIntentionParse{Title: "Nước hoa", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(2_000_000))},
	)
	reply := f.ask(t, "mua siêu xe, mua nước hoa")
	if reply.Intentions == nil || len(reply.Intentions.Items) != 1 || reply.Intentions.Skipped != 2 {
		t.Fatalf("expected one proposal and two skipped, got %+v", reply.Intentions)
	}

	f.client.parse = f.read(0.9, AIIntentionParse{Title: "Siêu xe", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(common.IntentionAmountCapXu))})
	if reply := f.ask(t, "mua siêu xe"); reply.Kind != string(model.ConsultKindUnsupported) || reply.Intentions != nil {
		t.Fatalf("with nothing readable there is no card, got %+v", reply)
	}
}

// More items than a message takes: the first ones are proposed and the card says the rest was not read.
func TestConsultIntention_TooManyItemsAreTruncated(t *testing.T) {
	f := newIntentionConsultFixture(t)
	var items []AIIntentionParse
	for i := 0; i < common.IntentionMaxPerMessage+2; i++ {
		items = append(items, AIIntentionParse{Title: "Món", Kind: common.IntentionKindOneTime, AmountVND: ptr(int64(100_000))})
	}
	f.client.parse = f.read(0.9, items...)
	reply := f.ask(t, "một danh sách dài")
	if got := reply.Intentions; got == nil || len(got.Items) != common.IntentionMaxPerMessage || !got.Truncated {
		t.Fatalf("expected %d proposals and the truncated flag, got %+v", common.IntentionMaxPerMessage, got)
	}
}

// A reading with no title is not a plan, and without the feature wired the
// kind is a sentence the System cannot answer.
func TestConsultIntention_Unusable(t *testing.T) {
	f := newIntentionConsultFixture(t)
	f.client.parse = f.read(0.9, AIIntentionParse{Title: "  ", Kind: common.IntentionKindOneTime})
	if reply := f.ask(t, "mua gì đó"); reply.Kind != string(model.ConsultKindUnsupported) {
		t.Fatalf("a reading with no title must be unsupported, got %+v", reply)
	}

	bare := newConsultFixture(t)
	bare.client.parse = &AIConsultParse{Kind: model.ParseKindIntention, Coverage: model.ParseCoverageFull, Intentions: []AIIntentionParse{{Title: "Giày", Kind: common.IntentionKindOneTime}}}
	if reply := ask(t, bare, "mua giày"); reply.Kind != string(model.ConsultKindUnsupported) {
		t.Fatalf("without intentions wired the kind must degrade to unsupported, got %+v", reply)
	}
}
