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

// BudgetService owns F-05's business rules — category-type/visibility
// validation at create time, the duplicate-active-Budget catch, full-replace
// limits on update, and the (stubbed) spend computation. Shape validation
// (limits map shape, period/start_date format) stays in dto/handler, never
// here.
type BudgetService struct {
	repo   BudgetRepo
	logger *zap.Logger
}

func NewBudgetService(repo BudgetRepo, logger *zap.Logger) *BudgetService {
	return &BudgetService{repo: repo, logger: logger}
}

// CreateBudget implements US-01. Category existence/visibility/type
// validation and the duplicate-active-Budget catch all happen inside one
// transaction, with a row lock on the category (spec.md S-BUD-14, plan.md
// Finding #2/#3) — closes the race with CategoryService.DeleteCategory.
func (s *BudgetService) CreateBudget(ctx context.Context, userID uuid.UUID, req dto.CreateBudgetRequest) (*model.Budget, error) {
	period := common.BudgetPeriodMonthly
	if req.Period != nil {
		period = *req.Period
	}

	startDate := time.Now().UTC()
	if req.StartDate != nil {
		parsed, err := time.Parse(common.DateOnlyLayout, *req.StartDate)
		if err != nil {
			// Handler-level validation already confirmed this shape — a
			// parse failure here would indicate an internal inconsistency,
			// not a fresh client mistake.
			return nil, fmt.Errorf("service.CreateBudget: parsing start_date: %w", err)
		}
		startDate = parsed
	}

	limits := make([]model.BudgetLimit, 0, len(req.Limits))
	for currency, amount := range req.Limits {
		limits = append(limits, model.BudgetLimit{Currency: currency, AmountLimit: amount})
	}

	budget, err := s.createBudgetTx(ctx, userID, req.CategoryID, period, startDate, limits, req.Icon, req.IconURL)
	if err != nil {
		return nil, err
	}
	// spec.md US-01 step 6: Create's response always shows spent=0/status=
	// "within" regardless of any pre-existing Transactions already in this
	// Category this period — a brand-new Budget has nothing tracked against
	// it yet from the caller's perspective. Passing a nil map is exactly
	// "0 spent for every currency" (a nil map read returns the zero value).
	s.computeStatus(budget, nil)
	return budget, nil
}

func (s *BudgetService) createBudgetTx(ctx context.Context, userID, categoryID uuid.UUID, period string, startDate time.Time, limits []model.BudgetLimit, icon, iconURL *string) (*model.Budget, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.CreateBudget: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	category, err := s.repo.LockCategoryForBudgetCheck(ctx, tx, categoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.CreateBudget: %w", err)
	}
	if category.DeletedAt != nil {
		return nil, common.ErrCategoryNotFound
	}
	if !category.IsSystem() && *category.UserID != userID {
		return nil, common.ErrCategoryAccessDenied
	}
	if category.Type != model.CategoryTypeExpense {
		return nil, common.ErrInvalidCategoryType
	}

	budget, err := s.repo.CreateBudget(ctx, tx, repository.CreateBudgetParams{
		UserID:     userID,
		CategoryID: categoryID,
		Period:     period,
		StartDate:  startDate,
		Limits:     limits,
		Icon:       icon,
		IconURL:    iconURL,
	})
	if err != nil {
		if isUniqueViolation(err) {
			// Lost a concurrent-create race for the same category, or the
			// caller already has an active Budget for it (spec.md
			// S-BUD-11/S-BUD-13).
			return nil, common.ErrBudgetAlreadyExists
		}
		return nil, fmt.Errorf("service.CreateBudget: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.CreateBudget: %w", err)
	}
	budget.CategoryName = category.Name
	return budget, nil
}

// ListBudgets implements US-02 — strictly scoped to the caller (CLAUDE.md
// user isolation rule). Spend is fetched via a single aggregate query across
// every one of the caller's Budgets, never N+1 per Budget/currency
// (specs/budget-management/spec.md US-02 Edge Cases #1) — closes BUD-T17.
func (s *BudgetService) ListBudgets(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error) {
	budgets, err := s.repo.ListBudgetsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ListBudgets: %w", err)
	}
	spentByCategory, err := s.repo.SpentByUserCurrentPeriod(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ListBudgets: %w", err)
	}
	for _, budget := range budgets {
		s.computeStatus(budget, spentByCategory[budget.CategoryID])
	}
	return budgets, nil
}

// GetBudget implements US-03 — distinguishes "belongs to someone else" (403)
// from "doesn't exist" (404), per spec.md S-BUD-24/S-BUD-25.
func (s *BudgetService) GetBudget(ctx context.Context, userID, budgetID uuid.UUID) (*model.Budget, error) {
	budget, err := s.getOwnedBudget(ctx, userID, budgetID)
	if err != nil {
		return nil, err
	}
	spentByCategory, err := s.repo.SpentByUserCurrentPeriod(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.GetBudget: %w", err)
	}
	s.computeStatus(budget, spentByCategory[budget.CategoryID])
	return budget, nil
}

// getOwnedBudget fetches a Budget by ID and enforces ownership — shared by
// GetBudget, UpdateBudget, and DeleteBudget so the 403-vs-404 split is
// decided in exactly one place.
func (s *BudgetService) getOwnedBudget(ctx context.Context, userID, budgetID uuid.UUID) (*model.Budget, error) {
	budget, err := s.repo.GetBudgetByID(ctx, budgetID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrBudgetNotFound
		}
		return nil, fmt.Errorf("service.getOwnedBudget: %w", err)
	}
	if budget.UserID != userID {
		return nil, common.ErrBudgetAccessDenied
	}
	return budget, nil
}

// UpdateBudget implements US-04. `limits` is a full replacement of the
// Budget's currency entries, never a per-currency merge (spec.md Edge Case
// US-04 #1, plan.md Finding #9) — delete-then-insert inside one transaction.
// Icon/IconURL are independent fields (specs/wallet-budget-icons/spec.md
// US-04 Edge Case #2): `limits` is only touched when the caller actually
// sent a `limits` key, so an icon-only update can never wipe existing
// budget_limits rows, and vice versa.
func (s *BudgetService) UpdateBudget(ctx context.Context, userID, budgetID uuid.UUID, req dto.UpdateBudgetRequest) (*model.Budget, error) {
	if !req.HasUpdates() {
		return nil, common.NewInvalidInputError("at least one of limits, icon, or icon_url must be provided")
	}
	if _, err := s.getOwnedBudget(ctx, userID, budgetID); err != nil {
		return nil, err
	}

	var limits []model.BudgetLimit
	if req.Limits != nil {
		limits = make([]model.BudgetLimit, 0, len(req.Limits))
		for currency, amount := range req.Limits {
			limits = append(limits, model.BudgetLimit{Currency: currency, AmountLimit: amount})
		}
	}

	if err := s.applyUpdateTx(ctx, userID, budgetID, req, limits); err != nil {
		return nil, err
	}

	budget, err := s.getOwnedBudget(ctx, userID, budgetID)
	if err != nil {
		return nil, err
	}
	// spec.md US-04 step 6 wants real recomputed spent against the *new*
	// limits (S-BUD-33) — unlike Create, this is never a bare spent=0.
	spentByCategory, err := s.repo.SpentByUserCurrentPeriod(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.UpdateBudget: %w", err)
	}
	s.computeStatus(budget, spentByCategory[budget.CategoryID])
	return budget, nil
}

// applyUpdateTx applies the two independent slices of change UpdateBudget
// now supports: `limits` (full-replace, only when req.Limits was actually
// sent) and icon/icon_url (applied unconditionally — a no-op COALESCE/
// presence-flag when the caller didn't touch them, same convention as
// UpdateWallet).
func (s *BudgetService) applyUpdateTx(ctx context.Context, userID, budgetID uuid.UUID, req dto.UpdateBudgetRequest, limits []model.BudgetLimit) error {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("service.UpdateBudget: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if req.Limits != nil {
		if err := s.repo.ReplaceBudgetLimits(ctx, tx, budgetID, limits); err != nil {
			return fmt.Errorf("service.UpdateBudget: %w", err)
		}
	}
	if _, err := s.repo.UpdateBudgetFields(ctx, tx, repository.UpdateBudgetFieldsParams{
		ID:              budgetID,
		UserID:          userID,
		Icon:            req.Icon,
		IconURL:         req.IconURL.Value,
		IconURLProvided: req.IconURL.Set,
	}); err != nil {
		return fmt.Errorf("service.UpdateBudget: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("service.UpdateBudget: %w", err)
	}
	return nil
}

// DeleteBudget implements US-05. No dependency check needed — nothing in the
// MVP schema references budgets.id (unlike Category's active-Budget guard),
// so deletion is unconditional once ownership is confirmed.
func (s *BudgetService) DeleteBudget(ctx context.Context, userID, budgetID uuid.UUID) (*model.Budget, error) {
	if _, err := s.getOwnedBudget(ctx, userID, budgetID); err != nil {
		return nil, err
	}

	deleted, err := s.repo.SoftDeleteBudget(ctx, budgetID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race to a concurrent delete of the same Budget between
			// the ownership check above and this write.
			return nil, common.ErrBudgetNotFound
		}
		return nil, fmt.Errorf("service.DeleteBudget: %w", err)
	}
	return deleted, nil
}

// computeStatus fills in each currency entry's Spent/Remaining/Status and
// the Budget's overall status from spentByCurrency — this Budget's
// category's real per-currency expense total for the current period,
// already aggregated by a single SUM(transactions.amount) ... GROUP BY
// category_id, currency query per request (BudgetRepo.SpentByUserCurrentPeriod,
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
