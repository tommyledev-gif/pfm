package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// BudgetRepository wraps the sqlc-generated budget queries and returns
// domain models, never sqlc's raw row structs. No business rules live here —
// category validation, duplicate-active-Budget handling, and the (stubbed)
// spend computation are all decided by BudgetService. Needs a caller-managed
// pgx.Tx for Create/Update, same reasoning as WalletRepository's default-swap.
type BudgetRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewBudgetRepository(q *sqlc.Queries, pool Beginner) *BudgetRepository {
	return &BudgetRepository{q: q, pool: pool}
}

// BeginTx starts a transaction the caller (BudgetService) commits or rolls
// back — see specs/budget-management/plan.md BUD-T7/BUD-T8/BUD-T10.
func (r *BudgetRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}

// LockCategoryForBudgetCheck takes a row lock on the category referenced by
// a new Budget, inside the caller's transaction — closes the create-vs-
// delete race with CategoryService.DeleteCategory (spec.md S-BUD-14,
// plan.md Finding #2/#3). Returns pgx.ErrNoRows if the category truly
// doesn't exist; a soft-deleted category is returned (not an error) so the
// caller can distinguish "not found" from "found but deleted".
func (r *BudgetRepository) LockCategoryForBudgetCheck(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (*model.Category, error) {
	row, err := r.q.WithTx(tx).LockCategoryByID(ctx, categoryID)
	if err != nil {
		return nil, err
	}
	return &model.Category{
		ID:        row.ID,
		UserID:    row.UserID,
		Name:      row.Name,
		Icon:      row.Icon,
		Type:      model.CategoryType(row.Type),
		CreatedAt: row.CreatedAt,
		DeletedAt: row.DeletedAt,
	}, nil
}

type CreateBudgetParams struct {
	UserID     uuid.UUID
	CategoryID uuid.UUID
	Period     string
	StartDate  time.Time
	Limits     []model.BudgetLimit
	Icon       *string
	IconURL    *string
}

// CreateBudget inserts the budgets row plus one budget_limits row per
// currency, all inside the caller's transaction (plan.md Finding #4).
func (r *BudgetRepository) CreateBudget(ctx context.Context, tx pgx.Tx, arg CreateBudgetParams) (*model.Budget, error) {
	row, err := r.q.WithTx(tx).CreateBudget(ctx, sqlc.CreateBudgetParams{
		UserID:     arg.UserID,
		CategoryID: arg.CategoryID,
		Period:     arg.Period,
		StartDate:  arg.StartDate,
		Icon:       arg.Icon,
		IconURL:    arg.IconURL,
	})
	if err != nil {
		return nil, err
	}

	for _, limit := range arg.Limits {
		if err := r.q.WithTx(tx).InsertBudgetLimit(ctx, sqlc.InsertBudgetLimitParams{
			BudgetID:    row.ID,
			Currency:    limit.Currency,
			AmountLimit: limit.AmountLimit,
		}); err != nil {
			return nil, err
		}
	}

	return &model.Budget{
		ID:         row.ID,
		UserID:     row.UserID,
		CategoryID: row.CategoryID,
		Period:     row.Period,
		StartDate:  row.StartDate,
		Limits:     stripComputedFields(arg.Limits),
		Icon:       row.Icon,
		IconURL:    row.IconURL,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		DeletedAt:  row.DeletedAt,
	}, nil
}

// ReplaceBudgetLimits deletes every existing currency row for a Budget and
// inserts the submitted set — full-replace semantics for PATCH (spec.md
// Edge Case US-04 #1, plan.md Finding #9), inside the caller's transaction.
func (r *BudgetRepository) ReplaceBudgetLimits(ctx context.Context, tx pgx.Tx, budgetID uuid.UUID, limits []model.BudgetLimit) error {
	if err := r.q.WithTx(tx).DeleteBudgetLimits(ctx, budgetID); err != nil {
		return err
	}
	for _, limit := range limits {
		if err := r.q.WithTx(tx).InsertBudgetLimit(ctx, sqlc.InsertBudgetLimitParams{
			BudgetID:    budgetID,
			Currency:    limit.Currency,
			AmountLimit: limit.AmountLimit,
		}); err != nil {
			return err
		}
	}
	return nil
}

// UpdateBudgetFieldsParams is BudgetRepository's own param type (mirrors
// UpdateWalletParams) — IconURL is only ever applied when IconURLProvided is
// true (dto.OptionalString / plan.md Finding #1): a nil IconURL with
// IconURLProvided=true means "clear the photo", not "leave it alone".
type UpdateBudgetFieldsParams struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	Icon            *string
	IconURL         *string
	IconURLProvided bool
}

// UpdateBudgetFields applies icon/icon_url and always bumps updated_at,
// inside the caller's transaction — supersedes the narrower
// TouchBudgetUpdatedAt this replaced, since every Update now needs an
// updated_at bump regardless of which fields changed.
func (r *BudgetRepository) UpdateBudgetFields(ctx context.Context, tx pgx.Tx, arg UpdateBudgetFieldsParams) (*model.Budget, error) {
	row, err := r.q.WithTx(tx).UpdateBudgetFields(ctx, sqlc.UpdateBudgetFieldsParams{
		ID:              arg.ID,
		UserID:          arg.UserID,
		Icon:            arg.Icon,
		IconURLProvided: arg.IconURLProvided,
		IconURL:         arg.IconURL,
	})
	if err != nil {
		return nil, err
	}
	return &model.Budget{
		ID:         row.ID,
		UserID:     row.UserID,
		CategoryID: row.CategoryID,
		Period:     row.Period,
		StartDate:  row.StartDate,
		Icon:       row.Icon,
		IconURL:    row.IconURL,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		DeletedAt:  row.DeletedAt,
	}, nil
}

// ListBudgetsByUser returns all of userID's non-deleted Budgets, each with
// its currency limits (AmountLimit only — Spent/Remaining/Status are filled
// in later by BudgetService.computeStatus, plan.md Finding #1).
func (r *BudgetRepository) ListBudgetsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error) {
	rows, err := r.q.ListBudgetsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListBudgetsByUser: %w", err)
	}

	limitsByBudget, err := r.limitsByBudgetID(ctx, budgetIDsOf(rows))
	if err != nil {
		return nil, fmt.Errorf("repository.ListBudgetsByUser: %w", err)
	}

	budgets := make([]*model.Budget, 0, len(rows))
	for _, row := range rows {
		budgets = append(budgets, &model.Budget{
			ID:           row.ID,
			UserID:       row.UserID,
			CategoryID:   row.CategoryID,
			CategoryName: row.CategoryName,
			Period:       row.Period,
			StartDate:    row.StartDate,
			Limits:       limitsByBudget[row.ID],
			Icon:         row.Icon,
			IconURL:      row.IconURL,
			CreatedAt:    row.CreatedAt,
			UpdatedAt:    row.UpdatedAt,
			DeletedAt:    row.DeletedAt,
		})
	}
	return budgets, nil
}

// GetBudgetByID returns pgx.ErrNoRows (unwrap with errors.Is) when no
// non-deleted budget matches — it is NOT scoped by user_id (see
// db/queries/budgets.sql); the service layer decides 403 vs. 404.
func (r *BudgetRepository) GetBudgetByID(ctx context.Context, id uuid.UUID) (*model.Budget, error) {
	row, err := r.q.GetBudgetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	limitsByBudget, err := r.limitsByBudgetID(ctx, []uuid.UUID{id})
	if err != nil {
		return nil, fmt.Errorf("repository.GetBudgetByID: %w", err)
	}

	return &model.Budget{
		ID:           row.ID,
		UserID:       row.UserID,
		CategoryID:   row.CategoryID,
		CategoryName: row.CategoryName,
		Period:       row.Period,
		StartDate:    row.StartDate,
		Limits:       limitsByBudget[row.ID],
		Icon:         row.Icon,
		IconURL:      row.IconURL,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
		DeletedAt:    row.DeletedAt,
	}, nil
}

// SoftDeleteBudget is scoped by id + user_id, same visibility guarantee as
// WalletRepository/CategoryRepository's delete. Returns pgx.ErrNoRows if
// id/user_id don't match a non-deleted row.
func (r *BudgetRepository) SoftDeleteBudget(ctx context.Context, id, userID uuid.UUID) (*model.Budget, error) {
	row, err := r.q.SoftDeleteBudget(ctx, sqlc.SoftDeleteBudgetParams{ID: id, UserID: userID})
	if err != nil {
		return nil, err
	}
	return &model.Budget{
		ID:         row.ID,
		UserID:     row.UserID,
		CategoryID: row.CategoryID,
		Period:     row.Period,
		StartDate:  row.StartDate,
		Icon:       row.Icon,
		IconURL:    row.IconURL,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		DeletedAt:  row.DeletedAt,
	}, nil
}

func (r *BudgetRepository) limitsByBudgetID(ctx context.Context, budgetIDs []uuid.UUID) (map[uuid.UUID][]model.BudgetLimit, error) {
	result := make(map[uuid.UUID][]model.BudgetLimit)
	if len(budgetIDs) == 0 {
		return result, nil
	}

	rows, err := r.q.ListBudgetLimitsByBudgetIDs(ctx, budgetIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.BudgetID] = append(result[row.BudgetID], model.BudgetLimit{
			Currency:    row.Currency,
			AmountLimit: row.AmountLimit,
		})
	}
	return result, nil
}

func budgetIDsOf(rows []sqlc.ListBudgetsByUserRow) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	return ids
}

// stripComputedFields drops any Spent/Remaining/Status the caller may have
// set (there shouldn't be any at create time) — CreateBudget's response
// only ever reflects freshly-inserted AmountLimit values.
func stripComputedFields(limits []model.BudgetLimit) []model.BudgetLimit {
	stripped := make([]model.BudgetLimit, len(limits))
	for i, l := range limits {
		stripped[i] = model.BudgetLimit{Currency: l.Currency, AmountLimit: l.AmountLimit}
	}
	return stripped
}
