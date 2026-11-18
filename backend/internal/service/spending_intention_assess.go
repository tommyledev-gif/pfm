package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Where an IntentionBudget's Spent comes from (dto.IntentionBudget).
const (
	budgetBasisThisCycle = "this_cycle"
	budgetBasisUsual     = "usual"
	budgetBasisLimit     = "limit"
)

// intentionAssessor weighs intentions against the User's own records
// (spec.md US-01 BR-04…BR-07, A-08). It is built once per request: the
// baseline, the Budgets and the plans are read once and shared by every row,
// so a list of fifty costs the same queries as a list of one.
//
// `plans` is everything that counts together: the intentions already kept
// and, for a sentence that named several items, the drafts it produced. Each
// intention is weighed against all the others in `plans`, and the portfolio
// weighs them all at once.
type intentionAssessor struct {
	currentMonth time.Time
	baselines    map[string]cycleBaseline
	budgets      map[uuid.UUID]*model.Budget
	plans        []*model.SpendingIntention
}

// newIntentionAssessor reads what the figures need for `currencies`.
func (s *SpendingIntentionService) newIntentionAssessor(ctx context.Context, userID uuid.UUID, currencies []string, plans []*model.SpendingIntention) (*intentionAssessor, error) {
	current, err := s.currentMonth(ctx, userID)
	if err != nil {
		return nil, err
	}
	a := &intentionAssessor{currentMonth: current, baselines: map[string]cycleBaseline{}, budgets: map[uuid.UUID]*model.Budget{}, plans: plans}
	for _, currency := range currencies {
		if _, done := a.baselines[currency]; done {
			continue
		}
		base, err := loadCycleBaseline(ctx, s.cycles, s.reports, userID, currency, common.IntentionBaselineCycles, true)
		if err != nil {
			return nil, fmt.Errorf("service.SpendingIntentionService.assess: %w", err)
		}
		a.baselines[currency] = base
	}
	budgets, err := s.budgets.ListBudgets(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.assess: %w", err)
	}
	for _, b := range budgets {
		a.budgets[b.CategoryID] = b
	}
	return a, nil
}

// assessedMonth is the month a plan is weighed in: its own, or the current
// cycle's once its month has passed, so an overdue plan is never left out of
// what is still to be paid (spec.md EC-13).
func (a *intentionAssessor) assessedMonth(i *model.SpendingIntention) time.Time {
	if monthIndex(i.TargetMonth) < monthIndex(a.currentMonth) {
		return a.currentMonth
	}
	return i.TargetMonth
}

// assess computes one intention's figures against everything else planned.
func (a *intentionAssessor) assess(i *model.SpendingIntention) dto.IntentionAssessment {
	out := dto.IntentionAssessment{Currency: i.Currency, Months: i.Months()}
	burden := i.MonthlyBurden()
	out.MonthlyBurden = burden
	switch {
	case i.TotalAmount != nil:
		out.Total = i.TotalAmount
	case burden != nil:
		total := *burden * int64(i.Months())
		out.Total = &total
	}

	assessed := a.assessedMonth(i)
	out.AssessedMonth = monthLabel(assessed)

	base := a.baselines[i.Currency]
	out.BaselineCycles = base.cycles
	if base.cycles > 0 {
		income, expense := roundNearest(base.income, i.Currency), roundNearest(base.expense, i.Currency)
		out.AvgIncome, out.AvgExpense = &income, &expense
	}
	out.Surplus = surplusOf(base, i.Currency)
	out.OtherPlanned = a.plannedIn(assessed, i.Currency, func(other *model.SpendingIntention) bool { return !sameIntention(other, i) })
	if out.Surplus != nil {
		headroom := roundDown(*out.Surplus-out.OtherPlanned, i.Currency)
		out.Headroom = &headroom
	}
	if burden != nil && out.Headroom != nil {
		fits := *burden <= *out.Headroom
		out.FitsSurplus = &fits
		if !fits {
			short := roundUp(*burden-*out.Headroom, i.Currency)
			out.ShortSurplus = &short
		}
	}
	if i.CategoryID != nil {
		inCategory := a.plannedIn(assessed, i.Currency, func(other *model.SpendingIntention) bool {
			return !sameIntention(other, i) && other.CategoryID != nil && *other.CategoryID == *i.CategoryID
		})
		out.Budget = a.budgetFor(*i.CategoryID, assessed, i.Currency, inCategory)
	}
	if out.Budget != nil && out.Budget.Left != nil && burden != nil {
		fits := *burden <= *out.Budget.Left
		out.FitsBudget = &fits
		if !fits {
			short := roundUp(*burden-*out.Budget.Left, i.Currency)
			out.ShortBudget = &short
		}
	}
	return out
}

// budgetFor is the Budget of a Category for one month, with `planned` (what
// the plans in that Category take that month) already counted against it.
// Nil when the Category has no Budget in the currency.
//
// The current cycle reads the real spending so far, exactly as the Budgets
// screen does. A later month has no real figure: it is weighed against what
// the Category usually spends (the recent cycles' average), which is the
// honest "actual spending" a Budget limit can be compared with; with no
// history it shows the limit only.
func (a *intentionAssessor) budgetFor(categoryID uuid.UUID, month time.Time, currency string, planned int64) *dto.IntentionBudget {
	budget := a.budgets[categoryID]
	if budget == nil {
		return nil
	}
	for _, l := range budget.Limits {
		if l.Currency != currency {
			continue
		}
		out := &dto.IntentionBudget{CategoryName: budget.CategoryName, Limit: l.AmountLimit, OtherPlanned: planned}
		base := a.baselines[currency]
		switch {
		case monthIndex(month) == monthIndex(a.currentMonth):
			out.Basis, out.Spent, out.Remaining = budgetBasisThisCycle, l.Spent, l.Remaining
			left := l.Remaining - planned
			out.Left = &left
		case base.cycles > 0:
			usual := roundNearest(base.byCategory[categoryID], currency)
			out.Basis, out.Spent, out.Remaining = budgetBasisUsual, usual, l.AmountLimit-usual
			left := roundDown(l.AmountLimit-usual-planned, currency)
			out.Left = &left
		default:
			out.Basis, out.Remaining = budgetBasisLimit, l.AmountLimit
		}
		return out
	}
	return nil
}

// plannedIn is what the plans that pass `count` take in `month`, in one
// currency: a one-time purchase in its own month, an instalment plan in each
// month of its run. The User's own amounts, so they are not rounded.
func (a *intentionAssessor) plannedIn(month time.Time, currency string, count func(*model.SpendingIntention) bool) int64 {
	var sum int64
	for _, plan := range a.plans {
		if plan.Currency != currency || plan.DeletedAt != nil || !count(plan) {
			continue
		}
		if burden := plan.MonthlyBurden(); burden != nil && a.paysIn(plan, month) {
			sum += *burden
		}
	}
	return sum
}

// paysIn: whether a plan takes a payment in `month`. A one-time plan whose
// month has passed is still to be paid, so it counts in the current month.
func (a *intentionAssessor) paysIn(plan *model.SpendingIntention, month time.Time) bool {
	at, current := monthIndex(month), monthIndex(a.currentMonth)
	start := monthIndex(plan.TargetMonth)
	end := start + plan.Months()
	if plan.Months() == 1 && start < current {
		start, end = current, current+1
	}
	return at >= start && at < end
}

// sameIntention: a kept intention is told apart by its id, a draft (no id)
// by being the very same value.
func sameIntention(a, b *model.SpendingIntention) bool {
	if a == b {
		return true
	}
	return a.ID != uuid.Nil && a.ID == b.ID
}
