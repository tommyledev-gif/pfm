package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ListTransactionsInWindow lists one type's Transactions (f.TxType, expense
// or income — required) in the filter's window and currency, newest first,
// at most limit rows. Backs the "anything unusual" answer, which buckets the
// rows itself (service/analytics_anomaly*.go). model.AnalyticsExpense carries
// an income row just as well: same columns, no note.
func (r *AnalyticsRepository) ListTransactionsInWindow(ctx context.Context, userID uuid.UUID, f AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error) {
	if f.TxType == nil {
		return nil, fmt.Errorf("repository.ListTransactionsInWindow: tx type is required")
	}
	rows, err := r.q.ListTransactionsInWindow(ctx, sqlc.ListTransactionsInWindowParams{
		UserID: userID, TxType: *f.TxType, Currency: f.Currency, WindowStart: f.Start, WindowEnd: f.End,
		CategoryIDs: f.CategoryIDs, WalletID: f.WalletID, RowLimit: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListTransactionsInWindow: %w", err)
	}
	out := make([]model.AnalyticsExpense, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.AnalyticsExpense{
			ID: row.ID, Amount: row.Amount, OccurredAt: row.OccurredAt,
			CategoryID: row.CategoryID, CategoryName: row.CategoryName, WalletName: row.WalletName,
		})
	}
	return out, nil
}
