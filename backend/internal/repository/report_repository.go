package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// ReportRepository wraps the sqlc-generated report aggregate queries and
// returns domain models, never sqlc's raw row structs. No business rules
// live here — window default-resolution and wallet/category ownership checks
// are decided by ReportService. Both queries it calls live in
// db/queries/transactions.sql, a file "owned" by TransactionRepository (cross-
// repository query exception, mirroring BudgetRepository.SpentByUserCurrentPeriod
// — specs/financial-reporting/plan.md Security & Actor Resolution).
type ReportRepository struct {
	q *sqlc.Queries
}

func NewReportRepository(q *sqlc.Queries) *ReportRepository {
	return &ReportRepository{q: q}
}

// ReportFilter carries US-01's optional query filters plus the already-
// resolved (never nil) report window — every pointer field left nil is a
// no-op AND clause at the SQL layer, same convention as
// TransactionRepository.ListTransactionsFilter.
type ReportFilter struct {
	From       time.Time
	To         time.Time
	WalletID   *uuid.UUID
	CategoryID *uuid.UUID
	Type       *string
}

// SumTotals backs the per-currency totals aggregate (spec.md US-01 step 5) —
// one query per request, grouped by (type, currency), ordered by currency
// (plan.md Finding #9). Returns raw, uncomputed rows — pivoting them into
// per-currency income/expense/net is ReportService's job (model.ReportTypeAmount
// doc comment), not this Repository's.
func (r *ReportRepository) SumTotals(ctx context.Context, userID uuid.UUID, filter ReportFilter) ([]model.ReportTypeAmount, error) {
	rows, err := r.q.SumReportTotalsByUser(ctx, sqlc.SumReportTotalsByUserParams{
		UserID:     userID,
		FromTs:     filter.From,
		ToTs:       filter.To,
		WalletID:   filter.WalletID,
		CategoryID: filter.CategoryID,
		Type:       filter.Type,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.SumTotals: %w", err)
	}

	entries := make([]model.ReportTypeAmount, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, model.ReportTypeAmount{Type: row.Type, Currency: row.Currency, Amount: row.Total})
	}
	return entries, nil
}

// SumByCategory backs the by_category aggregate (spec.md US-01 step 6),
// already ordered amount DESC by the query itself.
func (r *ReportRepository) SumByCategory(ctx context.Context, userID uuid.UUID, filter ReportFilter) ([]model.ReportCategoryEntry, error) {
	rows, err := r.q.SumReportByCategoryForUser(ctx, sqlc.SumReportByCategoryForUserParams{
		UserID:     userID,
		FromTs:     filter.From,
		ToTs:       filter.To,
		WalletID:   filter.WalletID,
		CategoryID: filter.CategoryID,
		Type:       filter.Type,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.SumByCategory: %w", err)
	}

	entries := make([]model.ReportCategoryEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, model.ReportCategoryEntry{
			CategoryID:   row.CategoryID,
			CategoryName: row.CategoryName,
			Type:         row.Type,
			Currency:     row.Currency,
			Amount:       row.Amount,
		})
	}
	return entries, nil
}
