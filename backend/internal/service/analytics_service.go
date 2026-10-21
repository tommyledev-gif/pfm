package service

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// AnalyticsService answers structured spending questions
// (specs/ai-chat-query-spending/spec.md US-02) — read-only, no language
// model anywhere (plan.md BR-11). Totals and breakdowns go through the same
// report queries as F-07 and remaining budget through BudgetService itself,
// so an answer can never disagree with the Reports or Budgets screen
// (plan.md BR-05/BR-06).
type AnalyticsService struct {
	reports    ReportRepo
	analytics  AnalyticsRepo
	wallets    WalletRepo
	categories CategoryRepo
	budgets    BudgetStatusReader
	cycles     *CycleResolver
	logger     *zap.Logger
}

func NewAnalyticsService(reports ReportRepo, analytics AnalyticsRepo, wallets WalletRepo, categories CategoryRepo, budgets BudgetStatusReader, cycles *CycleResolver, logger *zap.Logger) *AnalyticsService {
	return &AnalyticsService{
		reports: reports, analytics: analytics, wallets: wallets, categories: categories,
		budgets: budgets, cycles: cycles, logger: logger,
	}
}

// analyticsRun carries one question through computation.
type analyticsRun struct {
	userID        uuid.UUID
	q             model.AnalyticsQuery
	windows       analyticsWindows
	currency      string
	categoryNames []string
	answer        *dto.AnalyticsAnswerResponse
	otherCurrency map[string]bool
}

// Answer validates, authorizes, resolves the period and currency, computes
// the figures and wraps them with a summary, notices and follow-ups.
// Gating order: shape (handler) → cross-field rules → ownership (403) →
// computation.
func (s *AnalyticsService) Answer(ctx context.Context, userID uuid.UUID, req dto.AnalyticsQueryRequest) (*dto.AnalyticsAnswerResponse, error) {
	q, err := toAnalyticsQuery(req)
	if err != nil {
		return nil, err
	}
	wallet, err := s.ownedWallet(ctx, userID, q.WalletID)
	if err != nil {
		return nil, err
	}
	names, err := s.visibleCategories(ctx, userID, q.CategoryIDs)
	if err != nil {
		return nil, err
	}
	currency, err := s.resolveCurrency(ctx, userID, q, wallet)
	if err != nil {
		return nil, err
	}
	windows, err := s.resolveWindows(ctx, userID, q)
	if err != nil {
		return nil, err
	}

	run := &analyticsRun{
		userID: userID, q: q, windows: windows, currency: currency, categoryNames: names,
		otherCurrency: map[string]bool{},
		answer: &dto.AnalyticsAnswerResponse{
			SchemaVersion: common.AnalyticsSchemaVersion,
			Query:         req,
			Period:        periodResponse(q, windows, s.cycles.Location()),
			Currency:      currency,
			Notices:       []dto.AnalyticsNotice{},
			Chart:         dto.AnalyticsChart{Type: string(model.AnalyticsChartNone)},
		},
	}
	if err := s.compute(ctx, run); err != nil {
		return nil, fmt.Errorf("service.AnalyticsService.Answer: %w", err)
	}

	if len(run.otherCurrency) > 0 {
		run.answer.Notices = append(run.answer.Notices, noticeOtherCurrencies(sortedKeys(run.otherCurrency)))
	}
	run.answer.FollowUps = followUpsFor(req, run.answer, windows.monthly)
	return run.answer, nil
}

func (s *AnalyticsService) compute(ctx context.Context, run *analyticsRun) error {
	switch run.q.Metric {
	case model.AnalyticsMetricSum:
		return s.computeSum(ctx, run)
	case model.AnalyticsMetricCompare:
		return s.computeCompare(ctx, run)
	case model.AnalyticsMetricSeries:
		return s.computeSeries(ctx, run)
	case model.AnalyticsMetricBreakdown:
		switch run.q.GroupBy {
		case model.AnalyticsGroupByWallet:
			return s.computeWalletBreakdown(ctx, run)
		case model.AnalyticsGroupByWeekday:
			return s.computeWeekday(ctx, run)
		default:
			return s.computeCategoryBreakdown(ctx, run)
		}
	case model.AnalyticsMetricTopN, model.AnalyticsMetricMaxTx:
		return s.computeTopExpenses(ctx, run)
	case model.AnalyticsMetricAvgDaily:
		return s.computeAvgDaily(ctx, run)
	case model.AnalyticsMetricBudgetStatus:
		return s.computeBudgetStatus(ctx, run)
	case analyticsMetricAnomaly:
		return s.computeAnomaly(ctx, run)
	}
	return common.NewInvalidInputError("unsupported metric")
}

// ownedWallet enforces Wallet ownership (plan.md BR-01): another User's
// Wallet is 403, never an empty result.
func (s *AnalyticsService) ownedWallet(ctx context.Context, userID uuid.UUID, walletID *uuid.UUID) (*model.Wallet, error) {
	if walletID == nil {
		return nil, nil
	}
	wallet, err := s.wallets.GetWalletByID(ctx, *walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletNotFound
		}
		return nil, fmt.Errorf("service.AnalyticsService.ownedWallet: %w", err)
	}
	if wallet.UserID != userID {
		return nil, common.ErrWalletAccessDenied
	}
	return wallet, nil
}

// visibleCategories enforces Category visibility (system or own, BR-01) and
// returns the names in request order. A Category deleted since a follow-up
// chip was made is 404 CATEGORY_NOT_FOUND — the client shows that message,
// which is the "explains the Category no longer exists" branch of spec.md
// S-AIQ-36.
func (s *AnalyticsService) visibleCategories(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]string, error) {
	names := make([]string, 0, len(ids))
	for _, id := range ids {
		category, err := s.categories.GetCategoryByID(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, common.ErrCategoryNotFound
			}
			return nil, fmt.Errorf("service.AnalyticsService.visibleCategories: %w", err)
		}
		if category.UserID != nil && *category.UserID != userID {
			return nil, common.ErrCategoryAccessDenied
		}
		names = append(names, category.Name)
	}
	return names, nil
}

// resolveCurrency picks the one currency an answer covers (spec.md A-01):
// the named Wallet's, else the requested one, else the default Wallet's.
func (s *AnalyticsService) resolveCurrency(ctx context.Context, userID uuid.UUID, q model.AnalyticsQuery, wallet *model.Wallet) (string, error) {
	if wallet != nil {
		return wallet.Currency, nil
	}
	if q.Currency != "" {
		return q.Currency, nil
	}
	wallets, err := s.wallets.ListWalletsByUser(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("service.AnalyticsService.resolveCurrency: %w", err)
	}
	for _, w := range wallets {
		if w.IsDefault {
			return w.Currency, nil
		}
	}
	if len(wallets) > 0 {
		return wallets[0].Currency, nil
	}
	return common.WalletDefaultCurrency, nil
}

// reportFilter converts a half-open window to the report queries' inclusive
// upper bound (plan.md F6): timestamptz has microsecond resolution, so
// "<= end-1µs" selects exactly the same rows as "< end".
func reportFilter(w model.AnalyticsWindow, walletID *uuid.UUID, txType string) repository.ReportFilter {
	t := txType
	return repository.ReportFilter{From: w.Start, To: w.End.Add(-reportBoundResolution), WalletID: walletID, Type: &t}
}

func (run *analyticsRun) analyticsFilter(w model.AnalyticsWindow) repository.AnalyticsFilter {
	return repository.AnalyticsFilter{
		Currency: run.currency, Start: w.Start, End: w.End,
		AmountMin: run.q.AmountMin, CategoryIDs: run.q.CategoryIDs, WalletID: run.q.WalletID,
	}
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
