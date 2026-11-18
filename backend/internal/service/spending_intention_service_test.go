package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

type intentionFixture struct {
	*analyticsFixture
	repo     *fakeIntentionRepo
	budgets  *stubBudgets
	svc      *SpendingIntentionService
	shopping *model.Category
	income   *model.Category
}

// vnd is an amount in đồng as the xu the service stores.
func vnd(amount int64) int64 { return amount * common.VNDToCentsFactor }

func newIntentionFixture(t *testing.T) *intentionFixture {
	t.Helper()
	a := newAnalyticsFixture(t)
	shopping, err := a.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: a.userID, Name: "Mua sắm", Type: "expense"})
	if err != nil {
		t.Fatalf("seed category: %v", err)
	}
	salary, err := a.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: a.userID, Name: "Lương", Type: "income"})
	if err != nil {
		t.Fatalf("seed category: %v", err)
	}
	f := &intentionFixture{analyticsFixture: a, repo: &fakeIntentionRepo{}, budgets: &stubBudgets{}, shopping: shopping, income: salary}
	f.svc = NewSpendingIntentionService(f.repo, a.wallets, a.categories, a.reports, f.budgets, a.resolver, zap.NewNop())
	// Every completed cycle: income 20.000.000đ, spending 17.000.000đ → a 3.000.000đ surplus.
	a.reports.totals = func(repository.ReportFilter) []model.ReportTypeAmount {
		return []model.ReportTypeAmount{
			{Type: "income", Currency: "VND", Amount: vnd(20_000_000)},
			{Type: "expense", Currency: "VND", Amount: vnd(17_000_000)},
		}
	}
	return f
}

// usualCategorySpend makes a Category spend `amount` (đồng) in each completed cycle.
func (f *intentionFixture) usualCategorySpend(id uuid.UUID, amount int64) {
	f.reports.byCategory = func(repository.ReportFilter) []model.ReportCategoryEntry {
		return []model.ReportCategoryEntry{{CategoryID: id, CategoryName: "Mua sắm", Type: "expense", Currency: "VND", Amount: vnd(amount)}}
	}
}

// shoppingBudget is a Budget on the shopping Category, with its figures as the
// Budgets screen would show them this cycle.
func (f *intentionFixture) shoppingBudget(limit, spent int64) {
	f.budgets.list = []*model.Budget{{
		ID: uuid.New(), UserID: f.userID, CategoryID: f.shopping.ID, CategoryName: "Mua sắm",
		Limits: []model.BudgetLimit{{Currency: "VND", AmountLimit: vnd(limit), Spent: vnd(spent), Remaining: vnd(limit - spent)}},
	}}
}

func oneTime(title string, price int64) dto.CreateSpendingIntentionRequest {
	return dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: title, Kind: common.IntentionKindOneTime, TotalAmount: ptr(vnd(price)),
	}}
}

func mustCreate(t *testing.T, f *intentionFixture, req dto.CreateSpendingIntentionRequest) *dto.SpendingIntentionResponse {
	t.Helper()
	kept, _, err := f.svc.Create(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("create %q: %v", req.Title, err)
	}
	return kept
}

func fieldProblems(t *testing.T, err error) map[string]string {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
	fields, ok := appErr.Details.([]intentionField)
	if !ok {
		t.Fatalf("details = %T, want []intentionField", appErr.Details)
	}
	out := map[string]string{}
	for _, f := range fields {
		out[f.Field] = f.Rule
	}
	return out
}

// S-INT-16: a one-time purchase without a price is kept.
func TestIntention_Create_OneTimeWithoutPrice(t *testing.T) {
	f := newIntentionFixture(t)
	req := dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{Title: "Sữa tắm", Kind: common.IntentionKindOneTime}}
	kept := mustCreate(t, f, req)
	if kept.TotalAmount != nil || kept.Assessment.MonthlyBurden != nil || kept.Assessment.FitsSurplus != nil {
		t.Fatalf("no price must mean no burden and no verdict, got %+v", kept)
	}
	if kept.Assessment.Surplus == nil || *kept.Assessment.Surplus != vnd(3_000_000) {
		t.Fatalf("the surplus is still shown, got %v", kept.Assessment.Surplus)
	}
	if kept.TargetMonth != "2026-10" {
		t.Fatalf("an empty month is the current cycle's, got %s", kept.TargetMonth)
	}
}

// S-INT-04 / S-INT-05 / S-INT-17: the payment worked out from a total rounds
// up onto the suggested step, so the payments always cover the total.
func TestIntention_Create_InstallmentPaymentRoundsUp(t *testing.T) {
	cases := []struct {
		name     string
		total    int64
		months   int
		wantEach int64
	}{
		{"divides exactly", 18_000_000, 12, 1_500_000},
		{"1.666.667 rounds up to 1.700.000", 10_000_000, 6, 1_700_000},
		{"small step under 1.000.000", 300_000, 4, 75_000},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f := newIntentionFixture(t)
			kept := mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
				Title: "Trả góp", Kind: common.IntentionKindInstallment, TotalAmount: ptr(vnd(c.total)), InstallmentMonths: ptr(c.months),
			}})
			if kept.MonthlyAmount == nil || *kept.MonthlyAmount != vnd(c.wantEach) {
				t.Fatalf("monthly = %v, want %d", kept.MonthlyAmount, vnd(c.wantEach))
			}
			if *kept.MonthlyAmount*int64(c.months) < vnd(c.total) {
				t.Fatalf("payments %d must cover the total %d", *kept.MonthlyAmount*int64(c.months), vnd(c.total))
			}
		})
	}
}

// A monthly payment alone gives the total by multiplying; both given stay as stated.
func TestIntention_Create_InstallmentKeepsWhatIsStated(t *testing.T) {
	f := newIntentionFixture(t)
	fromPayment := mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Niềng răng", Kind: common.IntentionKindInstallment, MonthlyAmount: ptr(vnd(1_500_000)), InstallmentMonths: ptr(12),
	}})
	if fromPayment.TotalAmount == nil || *fromPayment.TotalAmount != vnd(18_000_000) {
		t.Fatalf("total = %v, want 18.000.000", fromPayment.TotalAmount)
	}
	both := mustCreate(t, f, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Laptop", Kind: common.IntentionKindInstallment, TotalAmount: ptr(vnd(10_000_000)), MonthlyAmount: ptr(vnd(1_750_000)), InstallmentMonths: ptr(6),
	}})
	if *both.TotalAmount != vnd(10_000_000) || *both.MonthlyAmount != vnd(1_750_000) {
		t.Fatalf("figures the User stated must stay as they are, got %v / %v", both.TotalAmount, both.MonthlyAmount)
	}
}

// S-INT-18 / S-INT-19: field problems are reported together.
func TestIntention_Create_CollectsEveryProblem(t *testing.T) {
	f := newIntentionFixture(t)
	_, _, err := f.svc.Create(context.Background(), f.userID, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "  ", Kind: common.IntentionKindInstallment, TotalAmount: ptr(common.IntentionAmountCapXu + 1), TargetMonth: "2026/12",
	}})
	got := fieldProblems(t, err)
	for _, field := range []string{"title", "installment_months", "total_amount", "target_month"} {
		if got[field] == "" {
			t.Fatalf("expected a problem on %s, got %v", field, got)
		}
	}
	if len(f.repo.rows) != 0 {
		t.Fatalf("nothing may be kept after a refusal")
	}
}

// BR-10: a one-time purchase carries no month count or payment.
func TestIntention_Create_OneTimeRejectsInstalmentFields(t *testing.T) {
	f := newIntentionFixture(t)
	_, _, err := f.svc.Create(context.Background(), f.userID, dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
		Title: "Giày", Kind: common.IntentionKindOneTime, MonthlyAmount: ptr(vnd(100_000)), InstallmentMonths: ptr(3),
	}})
	got := fieldProblems(t, err)
	if got["monthly_amount"] != intentionRuleNotAllowed || got["installment_months"] != intentionRuleNotAllowed {
		t.Fatalf("got %v", got)
	}
}

// S-INT-22: a month in the past is refused when saving; a month too far ahead too.
func TestIntention_Create_MonthWindow(t *testing.T) {
	f := newIntentionFixture(t)
	for month, rule := range map[string]string{"2026-09": intentionRulePast, "2030-12": intentionRuleTooFar} {
		req := oneTime("Giày", 500_000)
		req.TargetMonth = month
		_, _, err := f.svc.Create(context.Background(), f.userID, req)
		if got := fieldProblems(t, err); got["target_month"] != rule {
			t.Fatalf("%s: got %v, want %s", month, got, rule)
		}
	}
	req := oneTime("Giày", 500_000)
	req.TargetMonth = "2026-10"
	if _, _, err := f.svc.Create(context.Background(), f.userID, req); err != nil {
		t.Fatalf("the current month is allowed: %v", err)
	}
}

// S-INT-20 / S-INT-21: income Category refused; another User's is 403; a missing one 404.
func TestIntention_Create_Category(t *testing.T) {
	f := newIntentionFixture(t)
	foreign, err := f.categories.CreateCategory(context.Background(), repository.CreateCategoryParams{UserID: uuid.New(), Name: "Của người khác", Type: "expense"})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	cases := []struct {
		name string
		id   uuid.UUID
		code string
	}{
		{"income category", f.income.ID, common.ErrCodeInvalidInput},
		{"another User's category", foreign.ID, common.ErrCodeCategoryAccessDenied},
		{"missing category", uuid.New(), common.ErrCodeCategoryNotFound},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := oneTime("Nước hoa", 2_000_000)
			req.CategoryID = &c.id
			_, _, err := f.svc.Create(context.Background(), f.userID, req)
			var appErr *common.AppError
			if !errors.As(err, &appErr) || appErr.Code != c.code {
				t.Fatalf("got %v, want %s", err, c.code)
			}
		})
	}
	if len(f.repo.rows) != 0 {
		t.Fatalf("nothing may be kept after a refusal")
	}
}

// S-INT-15 / EC-11: saving the same card twice keeps one intention.
func TestIntention_Create_IsIdempotent(t *testing.T) {
	f := newIntentionFixture(t)
	req := oneTime("Nước hoa", 2_000_000)
	req.IdempotencyKey = "msg_1_1"
	first, created, err := f.svc.Create(context.Background(), f.userID, req)
	if err != nil || !created {
		t.Fatalf("first save: created=%v err=%v", created, err)
	}
	second, created, err := f.svc.Create(context.Background(), f.userID, req)
	if err != nil || created {
		t.Fatalf("second save must not create: created=%v err=%v", created, err)
	}
	if *first.ID != *second.ID || len(f.repo.rows) != 1 {
		t.Fatalf("expected one intention, got %d", len(f.repo.rows))
	}
}

// A card saved, deleted, then saved again is told so, never kept a second time.
func TestIntention_Create_SavedCardThatWasDeleted(t *testing.T) {
	f := newIntentionFixture(t)
	req := oneTime("Nước hoa", 2_000_000)
	req.IdempotencyKey = "msg_1_1"
	kept := mustCreate(t, f, req)
	if err := f.svc.Delete(context.Background(), f.userID, *kept.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, _, err := f.svc.Create(context.Background(), f.userID, req); !errors.Is(err, common.ErrSpendingIntentionDeleted) {
		t.Fatalf("got %v, want SPENDING_INTENTION_DELETED", err)
	}
}

// S-INT-23: the cap refuses one more, but a repeated save of a kept card still answers.
func TestIntention_Create_Cap(t *testing.T) {
	f := newIntentionFixture(t)
	first := oneTime("Cái đầu", 100_000)
	first.IdempotencyKey = "msg_first"
	mustCreate(t, f, first)
	for i := 1; i < common.IntentionMaxPerUser; i++ {
		mustCreate(t, f, oneTime("Một món", 100_000))
	}
	if _, _, err := f.svc.Create(context.Background(), f.userID, oneTime("Một món nữa", 100_000)); !errors.Is(err, common.ErrSpendingIntentionLimit) {
		t.Fatalf("got %v, want SPENDING_INTENTION_LIMIT_REACHED", err)
	}
	if _, created, err := f.svc.Create(context.Background(), f.userID, first); err != nil || created {
		t.Fatalf("a repeated save of a kept card must still answer: created=%v err=%v", created, err)
	}
}

// S-INT-28 / S-INT-34: an edit replaces the set, under the save rules.
func TestIntention_Update(t *testing.T) {
	f := newIntentionFixture(t)
	f.shoppingBudget(2_000_000, 1_300_000)
	req := oneTime("Nước hoa", 1_000_000)
	req.CategoryID = &f.shopping.ID
	kept := mustCreate(t, f, req)
	if kept.Assessment.FitsBudget == nil || *kept.Assessment.FitsBudget {
		t.Fatalf("1.000.000đ against 700.000đ left must not fit, got %+v", kept.Assessment)
	}

	edit := req.SpendingIntentionRequest
	edit.TotalAmount = ptr(vnd(600_000))
	updated, err := f.svc.Update(context.Background(), f.userID, *kept.ID, edit)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if *updated.Assessment.FitsBudget != true || updated.Assessment.ShortBudget != nil {
		t.Fatalf("600.000đ fits 700.000đ left, got %+v", updated.Assessment)
	}

	bad := edit
	bad.Kind, bad.InstallmentMonths = common.IntentionKindInstallment, ptr(1)
	if _, err := f.svc.Update(context.Background(), f.userID, *kept.ID, bad); fieldProblems(t, err)["installment_months"] != intentionRuleRange {
		t.Fatalf("a one-month instalment must be refused, got %v", err)
	}
	if f.repo.rows[0].TotalAmount == nil || *f.repo.rows[0].TotalAmount != vnd(600_000) {
		t.Fatalf("a refused edit must leave the old values")
	}
}

// S-INT-32 / S-INT-33 / BR-22: another User's or a deleted intention is not found.
func TestIntention_UpdateAndDelete_OnlyOwn(t *testing.T) {
	f := newIntentionFixture(t)
	kept := mustCreate(t, f, oneTime("Nước hoa", 2_000_000))
	stranger := uuid.New()
	if _, err := f.svc.Update(context.Background(), stranger, *kept.ID, oneTime("Sửa", 1).SpendingIntentionRequest); !errors.Is(err, common.ErrSpendingIntentionNotFound) {
		t.Fatalf("update by another User: got %v", err)
	}
	if err := f.svc.Delete(context.Background(), stranger, *kept.ID); !errors.Is(err, common.ErrSpendingIntentionNotFound) {
		t.Fatalf("delete by another User: got %v", err)
	}
	if err := f.svc.Delete(context.Background(), f.userID, *kept.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := f.svc.Delete(context.Background(), f.userID, *kept.ID); !errors.Is(err, common.ErrSpendingIntentionNotFound) {
		t.Fatalf("a repeated delete must be not found, got %v", err)
	}
	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil || len(list.Items) != 0 {
		t.Fatalf("a deleted intention must leave the list: %v %v", list, err)
	}
	if other, _ := f.svc.List(context.Background(), stranger); len(other.Items) != 0 {
		t.Fatalf("another User must see none")
	}
}

// S-INT-26: soonest month first.
func TestIntention_List_SoonestMonthFirst(t *testing.T) {
	f := newIntentionFixture(t)
	later := oneTime("Cuối năm", 1_000_000)
	later.TargetMonth = "2026-12"
	mustCreate(t, f, later)
	sooner := oneTime("Tháng sau", 1_000_000)
	sooner.TargetMonth = "2026-11"
	mustCreate(t, f, sooner)
	list, err := f.svc.List(context.Background(), f.userID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list.Items) != 2 || list.Items[0].Title != "Tháng sau" {
		t.Fatalf("expected the nearer month first, got %+v", list.Items)
	}
}

// Boundaries of spec.md BR-09…BR-14, one value each side of every limit.
func TestIntention_Create_Boundaries(t *testing.T) {
	type tc struct {
		name  string
		build func() dto.CreateSpendingIntentionRequest
		field string // "" means accepted
		rule  string
	}
	title := func(n int) string { return strings.Repeat("a", n) }
	instalment := func(months int) dto.CreateSpendingIntentionRequest {
		return dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{
			Title: "Trả góp", Kind: common.IntentionKindInstallment, TotalAmount: ptr(vnd(6_000_000)), InstallmentMonths: ptr(months),
		}}
	}
	withAmount := func(xu int64) dto.CreateSpendingIntentionRequest {
		return dto.CreateSpendingIntentionRequest{SpendingIntentionRequest: dto.SpendingIntentionRequest{Title: "Món", Kind: common.IntentionKindOneTime, TotalAmount: ptr(xu)}}
	}
	withMonth := func(month string) dto.CreateSpendingIntentionRequest {
		req := oneTime("Món", 100_000)
		req.TargetMonth = month
		return req
	}
	cases := []tc{
		{"title at the limit", func() dto.CreateSpendingIntentionRequest { return oneTime(title(common.IntentionTitleMaxLen), 1) }, "", ""},
		{"title past the limit", func() dto.CreateSpendingIntentionRequest { return oneTime(title(common.IntentionTitleMaxLen+1), 1) }, "title", intentionRuleMax},
		{"one month is not an instalment", func() dto.CreateSpendingIntentionRequest { return instalment(1) }, "installment_months", intentionRuleRange},
		{"two months", func() dto.CreateSpendingIntentionRequest { return instalment(2) }, "", ""},
		{"sixty months", func() dto.CreateSpendingIntentionRequest { return instalment(60) }, "", ""},
		{"sixty-one months", func() dto.CreateSpendingIntentionRequest { return instalment(61) }, "installment_months", intentionRuleRange},
		{"one xu", func() dto.CreateSpendingIntentionRequest { return withAmount(1) }, "", ""},
		{"the amount cap", func() dto.CreateSpendingIntentionRequest { return withAmount(common.IntentionAmountCapXu) }, "", ""},
		{"past the amount cap", func() dto.CreateSpendingIntentionRequest { return withAmount(common.IntentionAmountCapXu + 1) }, "total_amount", intentionRuleRange},
		{"zero xu", func() dto.CreateSpendingIntentionRequest { return withAmount(0) }, "total_amount", intentionRuleRange},
		{"the furthest month", func() dto.CreateSpendingIntentionRequest { return withMonth("2029-10") }, "", ""},
		{"one month past the horizon", func() dto.CreateSpendingIntentionRequest { return withMonth("2029-11") }, "target_month", intentionRuleTooFar},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f := newIntentionFixture(t)
			_, _, err := f.svc.Create(context.Background(), f.userID, c.build())
			if c.field == "" {
				if err != nil {
					t.Fatalf("expected it accepted, got %v", err)
				}
				return
			}
			if got := fieldProblems(t, err); got[c.field] != c.rule {
				t.Fatalf("got %v, want %s %s", got, c.field, c.rule)
			}
		})
	}
}

// A User with no Wallet still keeps an intention, in VND; a currency they hold no Wallet in is refused.
func TestIntention_Create_Currency(t *testing.T) {
	f := newIntentionFixture(t)
	f.wallets.wallets = nil
	if kept := mustCreate(t, f, oneTime("Giày", 500_000)); kept.Currency != "VND" {
		t.Fatalf("without a Wallet the currency is VND, got %s", kept.Currency)
	}

	g := newIntentionFixture(t)
	req := oneTime("Giày", 500_000)
	req.Currency = "USD"
	_, _, err := g.svc.Create(context.Background(), g.userID, req)
	if got := fieldProblems(t, err); got["currency"] != intentionRuleUnknown {
		t.Fatalf("a currency with no Wallet must be refused, got %v", got)
	}
}
