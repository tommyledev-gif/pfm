package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// computeStatus fills in each currency entry's Spent/Remaining/Status and
// the Budget's overall status from spentByCurrency — this Budget's
// category's real per-currency expense total for the current cycle,
// already aggregated by a single SUM(transactions.amount) ... GROUP BY
// category_id, currency query per request (BudgetRepo.SpentByUserInWindow,
// specs/transaction-management/plan.md Finding #3 / BUD-T17 — closes the
// stub this method used to be). spentByCurrency may be nil (CreateBudget's
// call, spec.md US-01 step 6: a freshly created Budget always reports
// spent=0 regardless of any pre-existing Transactions in that Category this
// period) — a nil map read returns the zero value, so this needs no special
// case here.
func (s *BudgetService) computeStatus(budget *model.Budget, spentByCurrency map[string]int64) {
	overall := model.BudgetStatusWithin
	for i := range budget.Limits {
		limit := &budget.Limits[i]
		limit.Spent = spentByCurrency[limit.Currency]
		limit.Remaining = limit.AmountLimit - limit.Spent
		limit.Status = model.BudgetStatusWithin
		if limit.Spent > limit.AmountLimit {
			limit.Status = model.BudgetStatusExceeded
			overall = model.BudgetStatusExceeded
		}
	}
	budget.OverallStatus = overall
}

// spentThisCycle is the caller's spend per category and currency in their
// current cycle — the single window every Budget figure is computed over
// (specs/ai-budget-wizard-v2/spec.md US-03 Edge Case #2).
func (s *BudgetService) spentThisCycle(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]map[string]int64, error) {
	window, err := s.cycles.Current(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.SpentByUserInWindow(ctx, userID, window.Start, window.End)
}
