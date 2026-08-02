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

	budget, err := s.createBudgetTx(ctx, userID, req.CategoryID, period, startDate, limits)
	if err != nil {
		return nil, err
	}
	s.computeStatus(budget)
	return budget, nil
}

func (s *BudgetService) createBudgetTx(ctx context.Context, userID, categoryID uuid.UUID, period string, startDate time.Time, limits []model.BudgetLimit) (*model.Budget, error) {
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
// user isolation rule).
func (s *BudgetService) ListBudgets(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error) {
	budgets, err := s.repo.ListBudgetsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ListBudgets: %w", err)
	}
	for _, budget := range budgets {
		s.computeStatus(budget)
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
	s.computeStatus(budget)
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
func (s *BudgetService) UpdateBudget(ctx context.Context, userID, budgetID uuid.UUID, req dto.UpdateBudgetRequest) (*model.Budget, error) {
	if !req.HasUpdates() {
		return nil, common.NewInvalidInputError("limits must be provided")
	}
	if _, err := s.getOwnedBudget(ctx, userID, budgetID); err != nil {
		return nil, err
	}

	limits := make([]model.BudgetLimit, 0, len(req.Limits))
	for currency, amount := range req.Limits {
		limits = append(limits, model.BudgetLimit{Currency: currency, AmountLimit: amount})
	}

	if err := s.replaceLimitsTx(ctx, userID, budgetID, limits); err != nil {
		return nil, err
	}

	budget, err := s.getOwnedBudget(ctx, userID, budgetID)
	if err != nil {
		return nil, err
	}
	s.computeStatus(budget)
	return budget, nil
}

func (s *BudgetService) replaceLimitsTx(ctx context.Context, userID, budgetID uuid.UUID, limits []model.BudgetLimit) error {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("service.UpdateBudget: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if err := s.repo.ReplaceBudgetLimits(ctx, tx, budgetID, limits); err != nil {
		return fmt.Errorf("service.UpdateBudget: %w", err)
	}
	if err := s.repo.TouchBudgetUpdatedAt(ctx, tx, budgetID, userID); err != nil {
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
// the Budget's overall status.
//
// STUBBED (specs/budget-management/plan.md Finding #1 / BUD-T17): Spent is
// always 0 because the `transactions` table (F-06) doesn't exist yet — this
// method is the single seam where the real
// `SUM(transactions.amount) ... GROUP BY category_id, currency` aggregate
// will be wired in later, with no change needed at any call site.
func (s *BudgetService) computeStatus(budget *model.Budget) {
	overall := model.BudgetStatusWithin
	for i := range budget.Limits {
		limit := &budget.Limits[i]
		limit.Spent = 0
		limit.Remaining = limit.AmountLimit - limit.Spent
		limit.Status = model.BudgetStatusWithin
		if limit.Spent > limit.AmountLimit {
			limit.Status = model.BudgetStatusExceeded
			overall = model.BudgetStatusExceeded
		}
	}
	budget.OverallStatus = overall
}
