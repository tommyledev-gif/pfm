package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// AnalyticsRepo backs AnalyticsService's aggregates the report queries cannot
// answer (specs/ai-chat-query-spending/plan.md AIQ-T14).
type AnalyticsRepo interface {
	ListExpensesByAmount(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error)
	CountTransactions(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter) (int64, error)
	SumExpenseByWallet(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter) ([]model.AnalyticsKeyedAmount, error)
	SumExpenseByLocalDay(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter, tz string) ([]model.AnalyticsDayAmount, error)
	ListTopCategoriesRecent(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]model.CategoryUsage, error)
	// Every row of a window: what the anomaly answer compares.
	ListTransactionsInWindow(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error)
}
