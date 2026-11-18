package service

import (
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// portfolios weighs everything planned together, one per currency (amounts in
// different currencies are never added, spec.md A-01). Each month that pays
// something is set against the usual surplus, and every Budget the plans touch
// against everything planned in its Category that month (spec.md A-08): two
// plans in "Mua sắm" share one Budget, and three plans in one month share one
// surplus.
func (a *intentionAssessor) portfolios() []dto.IntentionPortfolio {
	byCurrency := map[string][]*model.SpendingIntention{}
	var order []string
	for _, plan := range a.plans {
		if plan.DeletedAt != nil {
			continue
		}
		if _, seen := byCurrency[plan.Currency]; !seen {
			order = append(order, plan.Currency)
		}
		byCurrency[plan.Currency] = append(byCurrency[plan.Currency], plan)
	}
	out := make([]dto.IntentionPortfolio, 0, len(order))
	for _, currency := range order {
		out = append(out, a.portfolio(currency, byCurrency[currency]))
	}
	return out
}

func (a *intentionAssessor) portfolio(currency string, plans []*model.SpendingIntention) dto.IntentionPortfolio {
	base := a.baselines[currency]
	p := dto.IntentionPortfolio{Currency: currency, Count: len(plans), BaselineCycles: base.cycles, Months: []dto.IntentionMonthLoad{}}
	if base.cycles > 0 {
		income, expense := roundNearest(base.income, currency), roundNearest(base.expense, currency)
		p.AvgIncome, p.AvgExpense = &income, &expense
	}
	p.Surplus = surplusOf(base, currency)

	current := monthIndex(a.currentMonth)
	for at := current; at < current+common.IntentionPortfolioMonthsMax; at++ {
		month := a.currentMonth.AddDate(0, at-current, 0)
		planned := a.plannedIn(month, currency, func(*model.SpendingIntention) bool { return true })
		if planned == 0 {
			continue
		}
		load := dto.IntentionMonthLoad{Month: monthLabel(month), Planned: planned, Budgets: a.budgetLoads(month, currency)}
		if p.Surplus != nil {
			headroom := roundDown(*p.Surplus-planned, currency)
			fits := planned <= *p.Surplus
			load.Headroom, load.FitsSurplus = &headroom, &fits
			if !fits {
				short := roundUp(planned-*p.Surplus, currency)
				load.ShortSurplus = &short
			}
		}
		p.Months = append(p.Months, load)
	}
	return p
}

// budgetLoads is every Budget that has a plan in it in `month`, against the
// whole of what is planned in its Category, largest planned first and then by
// name so the order never changes between two reads.
func (a *intentionAssessor) budgetLoads(month time.Time, currency string) []dto.IntentionBudgetLoad {
	planned := map[uuid.UUID]int64{}
	for _, plan := range a.plans {
		if plan.Currency != currency || plan.DeletedAt != nil || plan.CategoryID == nil {
			continue
		}
		if burden := plan.MonthlyBurden(); burden != nil && a.paysIn(plan, month) {
			planned[*plan.CategoryID] += *burden
		}
	}
	loads := make([]dto.IntentionBudgetLoad, 0, len(planned))
	for id, sum := range planned {
		budget := a.budgetFor(id, month, currency, sum)
		if budget == nil {
			continue
		}
		load := dto.IntentionBudgetLoad{IntentionBudget: *budget}
		if budget.Left != nil {
			fits := *budget.Left >= 0
			load.Fits = &fits
			if !fits {
				short := roundUp(-*budget.Left, currency)
				load.Short = &short
			}
		}
		loads = append(loads, load)
	}
	sort.Slice(loads, func(i, j int) bool {
		if loads[i].OtherPlanned != loads[j].OtherPlanned {
			return loads[i].OtherPlanned > loads[j].OtherPlanned
		}
		return loads[i].CategoryName < loads[j].CategoryName
	})
	return loads
}
