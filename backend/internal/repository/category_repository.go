package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// CategoryRepository wraps the sqlc-generated category queries and returns
// domain models, never sqlc's raw row structs. No business rules live here —
// duplicate-checking, system-category guarding, and visibility splits are
// all decided by CategoryService. Create/List/Get/Update stay single-
// statement, no transaction needed — only Delete now needs one, to close the
// create-vs-delete race with Budget creation (specs/budget-management/plan.md
// Finding #2 / BUD-T15).
type CategoryRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewCategoryRepository(q *sqlc.Queries, pool Beginner) *CategoryRepository {
	return &CategoryRepository{q: q, pool: pool}
}

// BeginTx starts a transaction the caller (CategoryService.DeleteCategory)
// commits or rolls back — see specs/budget-management/plan.md BUD-T16.
func (r *CategoryRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}

type CreateCategoryParams struct {
	UserID  uuid.UUID
	Name    string
	Icon    *string
	Type    string
	IconURL *string
}

func (r *CategoryRepository) CreateCategory(ctx context.Context, arg CreateCategoryParams) (*model.Category, error) {
	row, err := r.q.CreateCategory(ctx, sqlc.CreateCategoryParams{
		UserID:  &arg.UserID,
		Name:    arg.Name,
		Icon:    arg.Icon,
		Type:    arg.Type,
		IconURL: arg.IconURL,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.CreateCategory: %w", err)
	}
	return toCategoryModel(row), nil
}

// NameTypeExists reports whether a category visible to userID (system OR
// their own) already has the given name/type, excluding excludeID (pass nil
// for Create, where there is no self row to exclude).
func (r *CategoryRepository) NameTypeExists(ctx context.Context, userID uuid.UUID, name, categoryType string, excludeID *uuid.UUID) (bool, error) {
	exists, err := r.q.NameTypeExists(ctx, sqlc.NameTypeExistsParams{
		UserID:    userID,
		Name:      name,
		Type:      categoryType,
		ExcludeID: excludeID,
	})
	if err != nil {
		return false, fmt.Errorf("repository.NameTypeExists: %w", err)
	}
	return exists, nil
}

// ListCategoriesForUser returns system categories plus userID's own,
// optionally filtered by categoryType (nil/empty means no filter).
func (r *CategoryRepository) ListCategoriesForUser(ctx context.Context, userID uuid.UUID, categoryType *string) ([]*model.Category, error) {
	rows, err := r.q.ListCategoriesForUser(ctx, sqlc.ListCategoriesForUserParams{
		UserID: userID,
		Type:   categoryType,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListCategoriesForUser: %w", err)
	}
	categories := make([]*model.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, toCategoryModel(row))
	}
	return categories, nil
}

// GetCategoryByID returns pgx.ErrNoRows (unwrap with errors.Is) when no
// non-deleted category matches — it is NOT scoped by user_id (see
// db/queries/categories.sql); the service layer decides visibility/403/404.
func (r *CategoryRepository) GetCategoryByID(ctx context.Context, id uuid.UUID) (*model.Category, error) {
	row, err := r.q.GetCategoryByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetCategoryByID: %w", err)
	}
	return toCategoryModel(row), nil
}

// GetCategoriesByIDs returns the live Categories among ids, in no set order;
// an id with no live Category is simply absent (never an error). Unscoped,
// like GetCategoryByID.
func (r *CategoryRepository) GetCategoriesByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.Category, error) {
	rows, err := r.q.GetCategoriesByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("repository.GetCategoriesByIDs: %w", err)
	}
	categories := make([]*model.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, toCategoryModel(row))
	}
	return categories, nil
}

// GetSystemCategoryByKey returns pgx.ErrNoRows (unwrap with errors.Is) when no
// live system Category carries that key.
func (r *CategoryRepository) GetSystemCategoryByKey(ctx context.Context, systemKey string) (*model.Category, error) {
	row, err := r.q.GetSystemCategoryByKey(ctx, &systemKey)
	if err != nil {
		return nil, fmt.Errorf("repository.GetSystemCategoryByKey: %w", err)
	}
	return toCategoryModel(row), nil
}

type UpdateCategoryParams struct {
	ID      uuid.UUID
	UserID  uuid.UUID
	Name    *string
	Icon    *string
	IconURL *string
}

// UpdateCategory is scoped by id + user_id — a system category or another
// user's category never matches, returning pgx.ErrNoRows (ownership must
// already have been checked by the caller via getOwnedCategory beforehand).
func (r *CategoryRepository) UpdateCategory(ctx context.Context, arg UpdateCategoryParams) (*model.Category, error) {
	row, err := r.q.UpdateCategory(ctx, sqlc.UpdateCategoryParams{
		ID:      arg.ID,
		UserID:  arg.UserID,
		Name:    arg.Name,
		Icon:    arg.Icon,
		IconURL: arg.IconURL,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.UpdateCategory: %w", err)
	}
	return toCategoryModel(row), nil
}

// SoftDeleteCategory is scoped by id + user_id, same visibility guarantee as
// UpdateCategory. Runs inside the caller's transaction (BUD-T16) so the lock
// + active-Budget check + this write are all atomic. Returns pgx.ErrNoRows
// if id/user_id don't match a non-deleted row (ownership must already be
// checked by the caller).
func (r *CategoryRepository) SoftDeleteCategory(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Category, error) {
	row, err := r.q.WithTx(tx).SoftDeleteCategory(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.SoftDeleteCategory: %w", err)
	}
	return toCategoryModel(row), nil
}

// LockCategoryByID takes a row lock on the category, inside the caller's
// transaction — closes the create-vs-delete race with BudgetService.
// CreateBudget (specs/budget-management/spec.md S-CAT-32, plan.md
// Finding #2/#3). Returns pgx.ErrNoRows only if the id has never existed;
// a soft-deleted category is returned (not an error), same convention as
// GetCategoryByID's sibling queries.
func (r *CategoryRepository) LockCategoryByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*model.Category, error) {
	row, err := r.q.WithTx(tx).LockCategoryByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.LockCategoryByID: %w", err)
	}
	return toCategoryModel(row), nil
}

// HasActiveBudgetForCategory backs the 409 CATEGORY_IN_USE delete guard
// (spec.md S-CAT-27) — queries the budgets table directly (a deliberate,
// narrow exception documented in specs/budget-management/plan.md Security &
// Actor Resolution), inside the caller's transaction.
func (r *CategoryRepository) HasActiveBudgetForCategory(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (bool, error) {
	exists, err := r.q.WithTx(tx).ExistsActiveBudgetForCategory(ctx, categoryID)
	if err != nil {
		return false, fmt.Errorf("repository.HasActiveBudgetForCategory: %w", err)
	}
	return exists, nil
}

func toCategoryModel(row sqlc.Category) *model.Category {
	return &model.Category{
		ID:        row.ID,
		UserID:    row.UserID,
		Name:      row.Name,
		Icon:      row.Icon,
		Type:      model.CategoryType(row.Type),
		CreatedAt: row.CreatedAt,
		DeletedAt: row.DeletedAt,
		IconURL:   row.IconURL,
		SystemKey: row.SystemKey,
	}
}
