package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// ReportService owns F-07's business rules — the independently-per-bound
// window default (spec.md Domain Concept table, plan.md Finding #6),
// wallet/category ownership checks (plan.md Finding #7), and calling the two
// aggregate queries exactly once each per request (spec.md Edge Cases US-01
// #7). Shape validation (type/wallet_id/category_id format) stays in
// dto/handler, never here. Covers US-01 through US-05 — one endpoint, query
// params vary (spec.md Context decision #1).
type ReportService struct {
	repo         ReportRepo
	walletRepo   WalletRepo
	categoryRepo CategoryRepo
	logger       *zap.Logger
}

func NewReportService(repo ReportRepo, walletRepo WalletRepo, categoryRepo CategoryRepo, logger *zap.Logger) *ReportService {
	return &ReportService{repo: repo, walletRepo: walletRepo, categoryRepo: categoryRepo, logger: logger}
}

// GetSummary resolves the report window, validates any wallet/category/type
// filter, and returns the aggregated totals and category breakdown.
func (s *ReportService) GetSummary(ctx context.Context, userID uuid.UUID, q dto.ReportSummaryQuery) (dto.ReportSummaryResponse, error) {
	from, to, err := resolveReportWindow(q.From, q.To)
	if err != nil {
		return dto.ReportSummaryResponse{}, err
	}

	filter := repository.ReportFilter{From: from, To: to}

	if q.WalletID != "" {
		walletID, err := uuid.Parse(q.WalletID)
		if err != nil {
			return dto.ReportSummaryResponse{}, common.NewInvalidInputError("wallet_id must be a valid UUID")
		}
		if _, err := s.getOwnedWallet(ctx, userID, walletID); err != nil {
			return dto.ReportSummaryResponse{}, err
		}
		filter.WalletID = &walletID
	}
	if q.CategoryID != "" {
		categoryID, err := uuid.Parse(q.CategoryID)
		if err != nil {
			return dto.ReportSummaryResponse{}, common.NewInvalidInputError("category_id must be a valid UUID")
		}
		if _, err := s.getVisibleCategory(ctx, userID, categoryID); err != nil {
			return dto.ReportSummaryResponse{}, err
		}
		filter.CategoryID = &categoryID
	}
	if q.Type != "" {
		filter.Type = &q.Type
	}

	rawTotals, err := s.repo.SumTotals(ctx, userID, filter)
	if err != nil {
		return dto.ReportSummaryResponse{}, fmt.Errorf("service.GetSummary: %w", err)
	}
	byCategory, err := s.repo.SumByCategory(ctx, userID, filter)
	if err != nil {
		return dto.ReportSummaryResponse{}, fmt.Errorf("service.GetSummary: %w", err)
	}

	return dto.NewReportSummaryResponse(from, to, pivotReportTotals(rawTotals), byCategory), nil
}

// pivotReportTotals merges raw (type, currency) rows into one ReportTotal per
// currency and derives Net = TotalIncome - TotalExpense — the business
// computation ReportRepository.SumTotals deliberately does not perform
// (model.ReportTypeAmount doc comment; mirrors BudgetService.computeStatus
// owning Spent/Remaining/Status instead of BudgetRepository). Preserves the
// repository's own currency ordering (plan.md Finding #9) by tracking each
// currency's first-seen position.
func pivotReportTotals(rows []model.ReportTypeAmount) []model.ReportTotal {
	totalsByCurrency := make(map[string]*model.ReportTotal, len(rows))
	order := make([]string, 0, len(rows))
	for _, row := range rows {
		total, ok := totalsByCurrency[row.Currency]
		if !ok {
			total = &model.ReportTotal{Currency: row.Currency}
			totalsByCurrency[row.Currency] = total
			order = append(order, row.Currency)
		}
		switch row.Type {
		case string(model.TransactionTypeIncome):
			total.TotalIncome = row.Amount
		case string(model.TransactionTypeExpense):
			total.TotalExpense = row.Amount
		}
	}

	totals := make([]model.ReportTotal, 0, len(order))
	for _, currency := range order {
		total := totalsByCurrency[currency]
		total.Net = total.TotalIncome - total.TotalExpense
		totals = append(totals, *total)
	}
	return totals
}

// resolveReportWindow defaults from/to independently, per missing bound, to
// the calendar month containing "now" (UTC) — plan.md Finding #6. Unlike
// TransactionService's from/to filter (no default — an omitted bound there
// is simply unbounded), an omitted bound here always resolves to a real
// timestamp, never left nil.
func resolveReportWindow(fromStr, toStr string) (time.Time, time.Time, error) {
	now := time.Now().UTC()
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	to := now

	if fromStr != "" {
		parsed, err := parseFlexibleTimestamp(fromStr)
		if err != nil {
			return time.Time{}, time.Time{}, common.NewInvalidInputError("from must be a valid date or timestamp")
		}
		from = parsed
	}
	if toStr != "" {
		parsed, err := parseFlexibleTimestamp(toStr)
		if err != nil {
			return time.Time{}, time.Time{}, common.NewInvalidInputError("to must be a valid date or timestamp")
		}
		to = parsed
	}
	if from.After(to) {
		return time.Time{}, time.Time{}, common.NewInvalidInputError("from must not be after to")
	}
	return from, to, nil
}

// getOwnedWallet mirrors TransactionService's own helper — duplicated here
// rather than shared because it belongs to a different service's dependency
// (WalletRepo), same reasoning as every other service having its own small
// ownership helper instead of a shared cross-service one (plan.md Finding #7).
func (s *ReportService) getOwnedWallet(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := s.walletRepo.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletNotFound
		}
		return nil, fmt.Errorf("service.getOwnedWallet: %w", err)
	}
	if wallet.UserID != userID {
		return nil, common.ErrWalletAccessDenied
	}
	return wallet, nil
}

// getVisibleCategory mirrors TransactionService's own visibility check —
// system categories are always visible, the caller's own are visible,
// anything else is a 403.
func (s *ReportService) getVisibleCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	category, err := s.categoryRepo.GetCategoryByID(ctx, categoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.getVisibleCategory: %w", err)
	}
	if category.IsSystem() || *category.UserID == userID {
		return category, nil
	}
	return nil, common.ErrCategoryAccessDenied
}
