package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// SpentByUserInWindow backs the real spend computation in
// BudgetService.computeStatus and F-10's budget job
// (specs/transaction-management/plan.md Finding #3 / BUD-T17) — one aggregate query per request across every one of the
// caller's Budgets, never N+1 (specs/budget-management/spec.md US-02 Edge
// Cases #1). Queries the transactions table directly (cross-repository query
// exception, mirroring WalletRepository.HasTransactionForWallet). The
// window is half-open [from, to), resolved by service.CycleResolver. The
// returned map is keyed by category ID, then currency.
func (r *BudgetRepository) SpentByUserInWindow(ctx context.Context, userID uuid.UUID, from, to time.Time) (map[uuid.UUID]map[string]int64, error) {
	rows, err := r.q.SumExpenseByUserCycle(ctx, sqlc.SumExpenseByUserCycleParams{UserID: userID, CycleStart: from, CycleEnd: to})
	if err != nil {
		return nil, fmt.Errorf("repository.SpentByUserInWindow: %w", err)
	}
	spent := make(map[uuid.UUID]map[string]int64, len(rows))
	for _, row := range rows {
		if spent[row.CategoryID] == nil {
			spent[row.CategoryID] = make(map[string]int64)
		}
		spent[row.CategoryID][row.Currency] = row.Spent
	}
	return spent, nil
}

// ListDistinctUserIDsWithActiveBudgets backs F-10's background job
// (specs/notification-handling/plan.md Finding #1) — the job loops this
// list, calling ListBudgetsByUser/SpentByUserInWindow per user, rather
// than a single global aggregate query.
func (r *BudgetRepository) ListDistinctUserIDsWithActiveBudgets(ctx context.Context) ([]uuid.UUID, error) {
	userIDs, err := r.q.ListDistinctUserIDsWithActiveBudgets(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository.ListDistinctUserIDsWithActiveBudgets: %w", err)
	}
	return userIDs, nil
}
