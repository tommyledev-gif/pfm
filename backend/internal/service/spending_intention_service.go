package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// SpendingIntentionService keeps what the User plans to spend and weighs it
// against their own Budgets and recorded spending
// (specs/ai-chat-spending-intentions). Every figure is computed here from
// records; the language model only ever reads a sentence into the editable set.
type SpendingIntentionService struct {
	repo       SpendingIntentionRepo
	wallets    WalletRepo
	categories CategoryRepo
	reports    ReportRepo
	budgets    BudgetStatusReader
	cycles     *CycleResolver
	logger     *zap.Logger
}

func NewSpendingIntentionService(repo SpendingIntentionRepo, wallets WalletRepo, categories CategoryRepo, reports ReportRepo, budgets BudgetStatusReader, cycles *CycleResolver, logger *zap.Logger) *SpendingIntentionService {
	return &SpendingIntentionService{repo: repo, wallets: wallets, categories: categories, reports: reports, budgets: budgets, cycles: cycles, logger: logger}
}

// Create keeps an intention. Saving the same card twice returns the one
// already kept (spec.md BR-16); the bool says whether this call kept a new one.
//
// Gating order: field rules (collected, BR-17) → Category (404 / 403 / 400) →
// cap (409) → write.
func (s *SpendingIntentionService) Create(ctx context.Context, userID uuid.UUID, req dto.CreateSpendingIntentionRequest) (*dto.SpendingIntentionResponse, bool, error) {
	key := strings.TrimSpace(req.IdempotencyKey)
	if key != "" {
		if existing, err := s.byKey(ctx, userID, key); existing != nil || err != nil {
			return s.respondKept(ctx, userID, existing, false, err)
		}
	}
	params, err := s.prepare(ctx, userID, req.SpendingIntentionRequest)
	if err != nil {
		return nil, false, err
	}
	count, err := s.repo.Count(ctx, userID)
	if err != nil {
		return nil, false, fmt.Errorf("service.SpendingIntentionService.Create: %w", err)
	}
	if count >= common.IntentionMaxPerUser {
		return nil, false, common.ErrSpendingIntentionLimit
	}
	var keyPtr *string
	if key != "" {
		keyPtr = &key
	}
	kept, err := s.repo.Create(ctx, userID, params, keyPtr)
	if errors.Is(err, repository.ErrIntentionKeyTaken) {
		// Another request kept this card between the lookup and the insert.
		existing, lookupErr := s.byKey(ctx, userID, key)
		return s.respondKept(ctx, userID, existing, false, lookupErr)
	}
	if err != nil {
		return nil, false, fmt.Errorf("service.SpendingIntentionService.Create: %w", err)
	}
	return s.respondKept(ctx, userID, kept, true, nil)
}

// respondKept turns the row a create ended on into the response.
func (s *SpendingIntentionService) respondKept(ctx context.Context, userID uuid.UUID, kept *model.SpendingIntention, created bool, err error) (*dto.SpendingIntentionResponse, bool, error) {
	if err != nil {
		return nil, false, err
	}
	if kept == nil {
		return nil, false, common.ErrSpendingIntentionNotFound
	}
	if kept.DeletedAt != nil {
		return nil, false, common.ErrSpendingIntentionDeleted
	}
	res, err := s.respondOne(ctx, userID, kept)
	return res, created, err
}

// byKey finds the intention a card was kept as: nil, nil when there is none.
func (s *SpendingIntentionService) byKey(ctx context.Context, userID uuid.UUID, key string) (*model.SpendingIntention, error) {
	found, err := s.repo.GetByKey(ctx, userID, key)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.byKey: %w", err)
	}
	return found, nil
}

// List returns the User's intentions, soonest month first, with live figures.
func (s *SpendingIntentionService) List(ctx context.Context, userID uuid.UUID) (*dto.SpendingIntentionListResponse, error) {
	items, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.List: %w", err)
	}
	responses, portfolios, err := s.respondMany(ctx, userID, items, items)
	if err != nil {
		return nil, err
	}
	return &dto.SpendingIntentionListResponse{Items: responses, Portfolios: portfolios}, nil
}

// Update replaces the editable set under the same rules as Create (BR-19).
func (s *SpendingIntentionService) Update(ctx context.Context, userID, id uuid.UUID, req dto.SpendingIntentionRequest) (*dto.SpendingIntentionResponse, error) {
	if _, err := s.repo.GetByID(ctx, userID, id); err != nil {
		return nil, notFoundOr(err, "Update")
	}
	params, err := s.prepare(ctx, userID, req)
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.Update(ctx, userID, id, params)
	if err != nil {
		return nil, notFoundOr(err, "Update")
	}
	return s.respondOne(ctx, userID, updated)
}

// Delete soft-deletes the User's own intention (BR-20, BR-21).
func (s *SpendingIntentionService) Delete(ctx context.Context, userID, id uuid.UUID) error {
	deleted, err := s.repo.Delete(ctx, userID, id)
	if err != nil {
		return fmt.Errorf("service.SpendingIntentionService.Delete: %w", err)
	}
	if !deleted {
		return common.ErrSpendingIntentionNotFound
	}
	return nil
}

func notFoundOr(err error, op string) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return common.ErrSpendingIntentionNotFound
	}
	return fmt.Errorf("service.SpendingIntentionService.%s: %w", op, err)
}

// prepare runs the rules a save shares with an edit: currency, field rules,
// then the Category.
func (s *SpendingIntentionService) prepare(ctx context.Context, userID uuid.UUID, req dto.SpendingIntentionRequest) (repository.SpendingIntentionParams, error) {
	currency, problems, err := s.resolveCurrency(ctx, userID, req.Currency)
	if err != nil {
		return repository.SpendingIntentionParams{}, err
	}
	current, err := s.currentMonth(ctx, userID)
	if err != nil {
		return repository.SpendingIntentionParams{}, err
	}
	normalized, more := intentionRules{currency: currency, currentMonth: current}.normalize(req)
	if problems = append(problems, more...); len(problems) > 0 {
		return repository.SpendingIntentionParams{}, common.NewInvalidInputErrorWithDetails("spending intention failed validation", problems)
	}
	if err := s.checkCategory(ctx, userID, normalized.params.CategoryID); err != nil {
		return repository.SpendingIntentionParams{}, err
	}
	return normalized.params, nil
}

// checkCategory: the Category must be visible to the User (system or own) and
// an expense Category (spec.md BR-13). Another User's is 403, never "empty".
func (s *SpendingIntentionService) checkCategory(ctx context.Context, userID uuid.UUID, id *uuid.UUID) error {
	if id == nil {
		return nil
	}
	found, err := s.categories.GetCategoriesByIDs(ctx, []uuid.UUID{*id})
	if err != nil {
		return fmt.Errorf("service.SpendingIntentionService.checkCategory: %w", err)
	}
	if len(found) == 0 {
		return common.ErrCategoryNotFound
	}
	category := found[0]
	if category.UserID != nil && *category.UserID != userID {
		return common.ErrCategoryAccessDenied
	}
	if category.Type != model.CategoryTypeExpense {
		return common.NewInvalidInputErrorWithDetails("spending intention failed validation", []intentionField{{Field: "category_id", Rule: intentionRuleUnknown}})
	}
	return nil
}

// resolveCurrency is the plan's currency: the one named, if the User holds a
// Wallet in it, else the default Wallet's (spec.md A-01).
func (s *SpendingIntentionService) resolveCurrency(ctx context.Context, userID uuid.UUID, named string) (string, []intentionField, error) {
	wallets, err := s.wallets.ListWalletsByUser(ctx, userID)
	if err != nil {
		return "", nil, fmt.Errorf("service.SpendingIntentionService.resolveCurrency: %w", err)
	}
	fallback := common.WalletDefaultCurrency
	if len(wallets) > 0 {
		fallback = wallets[0].Currency
	}
	for _, w := range wallets {
		if w.IsDefault {
			fallback = w.Currency
			break
		}
	}
	if named == "" {
		return fallback, nil, nil
	}
	for _, w := range wallets {
		if w.Currency == named {
			return named, nil, nil
		}
	}
	if len(wallets) == 0 && named == common.WalletDefaultCurrency {
		return named, nil, nil
	}
	return fallback, []intentionField{{Field: "currency", Rule: intentionRuleUnknown}}, nil
}

// currentMonth is the first day of the month the User's current cycle starts in.
func (s *SpendingIntentionService) currentMonth(ctx context.Context, userID uuid.UUID) (time.Time, error) {
	window, err := s.cycles.Current(ctx, userID)
	if err != nil {
		return time.Time{}, fmt.Errorf("service.SpendingIntentionService.currentMonth: %w", err)
	}
	return monthStart(window.Start.In(s.cycles.Location())), nil
}
