package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// AnalyticsRepository wraps the read-only aggregates in analytics.sql
// (specs/ai-chat-query-spending/plan.md AIQ-T12/T14). Like ReportRepository
// it reads the transactions table it does not own — the same accepted
// cross-repository exception. No business rules here: windows, currency and
// ownership are all resolved by AnalyticsService before these run.
type AnalyticsRepository struct {
	q *sqlc.Queries
}

func NewAnalyticsRepository(q *sqlc.Queries) *AnalyticsRepository {
	return &AnalyticsRepository{q: q}
}

// AnalyticsFilter is one currency over one half-open window, plus optional
// narrowing. Nil/empty fields are no-ops.
type AnalyticsFilter struct {
	Currency    string
	Start       time.Time
	End         time.Time
	TxType      *string
	AmountMin   *int64
	CategoryIDs []uuid.UUID
	WalletID    *uuid.UUID
}

func (r *AnalyticsRepository) ListExpensesByAmount(ctx context.Context, userID uuid.UUID, f AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error) {
	rows, err := r.q.ListExpensesByAmount(ctx, sqlc.ListExpensesByAmountParams{
		UserID: userID, Currency: f.Currency, WindowStart: f.Start, WindowEnd: f.End,
		AmountMin: f.AmountMin, CategoryIDs: f.CategoryIDs, WalletID: f.WalletID, RowLimit: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListExpensesByAmount: %w", err)
	}
	out := make([]model.AnalyticsExpense, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.AnalyticsExpense{
			ID: row.ID, Amount: row.Amount, OccurredAt: row.OccurredAt,
			CategoryName: row.CategoryName, WalletName: row.WalletName,
		})
	}
	return out, nil
}

func (r *AnalyticsRepository) CountTransactions(ctx context.Context, userID uuid.UUID, f AnalyticsFilter) (int64, error) {
	count, err := r.q.CountTransactionsInWindow(ctx, sqlc.CountTransactionsInWindowParams{
		UserID: userID, Currency: f.Currency, WindowStart: f.Start, WindowEnd: f.End,
		TxType: f.TxType, AmountMin: f.AmountMin, CategoryIDs: f.CategoryIDs, WalletID: f.WalletID,
	})
	if err != nil {
		return 0, fmt.Errorf("repository.CountTransactions: %w", err)
	}
	return count, nil
}

func (r *AnalyticsRepository) SumExpenseByWallet(ctx context.Context, userID uuid.UUID, f AnalyticsFilter) ([]model.AnalyticsKeyedAmount, error) {
	rows, err := r.q.SumExpenseByWalletForUser(ctx, sqlc.SumExpenseByWalletForUserParams{
		UserID: userID, Currency: f.Currency, WindowStart: f.Start, WindowEnd: f.End,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.SumExpenseByWallet: %w", err)
	}
	out := make([]model.AnalyticsKeyedAmount, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.AnalyticsKeyedAmount{Key: row.WalletID, Label: row.WalletName, Amount: row.Amount})
	}
	return out, nil
}

// SumExpenseByLocalDay buckets by calendar day in tz (an IANA name).
func (r *AnalyticsRepository) SumExpenseByLocalDay(ctx context.Context, userID uuid.UUID, f AnalyticsFilter, tz string) ([]model.AnalyticsDayAmount, error) {
	rows, err := r.q.SumExpenseByLocalDay(ctx, sqlc.SumExpenseByLocalDayParams{
		Tz: tz, UserID: userID, Currency: f.Currency, WindowStart: f.Start, WindowEnd: f.End, CategoryIDs: f.CategoryIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.SumExpenseByLocalDay: %w", err)
	}
	out := make([]model.AnalyticsDayAmount, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.AnalyticsDayAmount{Day: row.Day, Amount: row.Amount})
	}
	return out, nil
}

func (r *AnalyticsRepository) ListTopCategoriesRecent(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]model.CategoryUsage, error) {
	rows, err := r.q.ListTopCategoriesRecent(ctx, sqlc.ListTopCategoriesRecentParams{UserID: userID, Since: since, RowLimit: int32(limit)})
	if err != nil {
		return nil, fmt.Errorf("repository.ListTopCategoriesRecent: %w", err)
	}
	out := make([]model.CategoryUsage, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.CategoryUsage{ID: row.CategoryID, Name: row.CategoryName, Type: row.CategoryType, TxCount: row.TxCount})
	}
	return out, nil
}
