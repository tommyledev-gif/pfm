package service

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeCategoryRepo is an in-memory stand-in for CategoryRepo, used instead of
// a real Postgres per Go Test Conventions — same approach as fakeWalletRepo.
// BeginTx/LockCategoryByID/HasActiveBudgetForCategory were added by
// specs/budget-management/plan.md Finding #2 / BUD-T15 — DeleteCategory now
// runs inside a transaction to close the create-vs-delete race with Budget
// creation and to back the 409 CATEGORY_IN_USE check; the fake reuses
// fakeTx (defined in fake_wallet_repo_test.go, same package) since it's a
// no-op stand-in regardless of which feature's service opened it.
type fakeCategoryRepo struct {
	mu             sync.Mutex
	categories     map[uuid.UUID]*model.Category
	activeBudgeted map[uuid.UUID]bool // categoryID -> has an active Budget (test-only setter below)
}

func newFakeCategoryRepo() *fakeCategoryRepo {
	return &fakeCategoryRepo{
		categories:     make(map[uuid.UUID]*model.Category),
		activeBudgeted: make(map[uuid.UUID]bool),
	}
}

func (f *fakeCategoryRepo) BeginTx(context.Context) (pgx.Tx, error) {
	return &fakeTx{}, nil
}

// setActiveBudget is a test helper simulating "an active Budget references
// this category" for HasActiveBudgetForCategory (spec.md S-CAT-27 tests).
func (f *fakeCategoryRepo) setActiveBudget(categoryID uuid.UUID, active bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.activeBudgeted[categoryID] = active
}

func (f *fakeCategoryRepo) HasActiveBudgetForCategory(_ context.Context, _ pgx.Tx, categoryID uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.activeBudgeted[categoryID], nil
}

// LockCategoryByID mirrors GetCategoryByID but is NOT filtered by
// deleted_at — a soft-deleted category is returned (not pgx.ErrNoRows), same
// contract as the real query (see db/queries/categories.sql).
func (f *fakeCategoryRepo) LockCategoryByID(_ context.Context, _ pgx.Tx, id uuid.UUID) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	c, ok := f.categories[id]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *c
	return &cp, nil
}

// seedSystemCategory is a test helper — inserts a category with user_id NULL
// directly, bypassing CreateCategory (which always assigns a caller as owner,
// matching the real API: system categories are migration-seeded, never
// created through this endpoint).
func (f *fakeCategoryRepo) seedSystemCategory(name, categoryType string) *model.Category {
	f.mu.Lock()
	defer f.mu.Unlock()

	c := &model.Category{
		ID:        uuid.New(),
		UserID:    nil,
		Name:      name,
		Type:      model.CategoryType(categoryType),
		CreatedAt: time.Now().UTC(),
	}
	f.categories[c.ID] = c
	return c
}

// CreateCategory mirrors idx_categories_owner_name_type_unique's own-scope
// case: a concurrent create for the same user/name/type loses the race
// exactly like the real partial unique index would.
func (f *fakeCategoryRepo) CreateCategory(_ context.Context, arg repository.CreateCategoryParams) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, c := range f.categories {
		if c.DeletedAt == nil && c.UserID != nil && *c.UserID == arg.UserID &&
			strings.EqualFold(c.Name, arg.Name) && string(c.Type) == arg.Type {
			return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_categories_owner_name_type_unique"}
		}
	}

	userID := arg.UserID
	c := &model.Category{
		ID:        uuid.New(),
		UserID:    &userID,
		Name:      arg.Name,
		Icon:      arg.Icon,
		Type:      model.CategoryType(arg.Type),
		CreatedAt: time.Now().UTC(),
	}
	f.categories[c.ID] = c
	cp := *c
	return &cp, nil
}

// NameTypeExists mirrors the cross-scope (system + own) duplicate check that
// only the service layer performs (plan.md Finding #3) — not DB-enforced.
func (f *fakeCategoryRepo) NameTypeExists(_ context.Context, userID uuid.UUID, name, categoryType string, excludeID *uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, c := range f.categories {
		if c.DeletedAt != nil {
			continue
		}
		if excludeID != nil && c.ID == *excludeID {
			continue
		}
		visible := c.UserID == nil || *c.UserID == userID
		if visible && strings.EqualFold(c.Name, name) && string(c.Type) == categoryType {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeCategoryRepo) ListCategoriesForUser(_ context.Context, userID uuid.UUID, categoryType *string) ([]*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Category
	for _, c := range f.categories {
		if c.DeletedAt != nil {
			continue
		}
		if !(c.UserID == nil || *c.UserID == userID) {
			continue
		}
		if categoryType != nil && string(c.Type) != *categoryType {
			continue
		}
		cp := *c
		out = append(out, &cp)
	}
	return out, nil
}

func (f *fakeCategoryRepo) GetCategoryByID(_ context.Context, id uuid.UUID) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	c, ok := f.categories[id]
	if !ok || c.DeletedAt != nil {
		return nil, pgx.ErrNoRows
	}
	cp := *c
	return &cp, nil
}

func (f *fakeCategoryRepo) UpdateCategory(_ context.Context, arg repository.UpdateCategoryParams) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	c, ok := f.categories[arg.ID]
	if !ok || c.DeletedAt != nil || c.UserID == nil || *c.UserID != arg.UserID {
		return nil, pgx.ErrNoRows
	}
	if arg.Name != nil {
		c.Name = *arg.Name
	}
	if arg.Icon != nil {
		c.Icon = arg.Icon
	}
	cp := *c
	return &cp, nil
}

func (f *fakeCategoryRepo) SoftDeleteCategory(_ context.Context, _ pgx.Tx, id, userID uuid.UUID) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	c, ok := f.categories[id]
	if !ok || c.DeletedAt != nil || c.UserID == nil || *c.UserID != userID {
		return nil, pgx.ErrNoRows
	}
	now := time.Now().UTC()
	c.DeletedAt = &now
	cp := *c
	return &cp, nil
}

func (f *fakeCategoryRepo) GetSystemCategoryByKey(_ context.Context, systemKey string) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, c := range f.categories {
		if c.UserID == nil && c.SystemKey != nil && *c.SystemKey == systemKey && c.DeletedAt == nil {
			cp := *c
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}
