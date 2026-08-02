package service

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeBudgetRepo is an in-memory stand-in for BudgetRepo, used instead of a
// real Postgres per Go Test Conventions — same approach as
// fakeWalletRepo/fakeCategoryRepo. Reuses fakeTx (fake_wallet_repo_test.go,
// same package) for BeginTx, since it's a no-op regardless of which
// service opened it.
type fakeBudgetRepo struct {
	mu         sync.Mutex
	budgets    map[uuid.UUID]*model.Budget
	categories map[uuid.UUID]*model.Category
	// spent backs SpentByUserCurrentPeriod (BUD-T17) — nil until a test
	// calls seedSpend, in which case ListBudgets/GetBudget/UpdateBudget see
	// 0 for every currency, matching a real caller with no Transactions yet.
	spent map[uuid.UUID]map[string]int64
}

func newFakeBudgetRepo() *fakeBudgetRepo {
	return &fakeBudgetRepo{
		budgets:    make(map[uuid.UUID]*model.Budget),
		categories: make(map[uuid.UUID]*model.Category),
	}
}

// seedCategory is a test helper — BudgetService looks categories up via
// LockCategoryForBudgetCheck, which this fake backs with its own in-memory
// map rather than delegating to fakeCategoryRepo (the two repos are
// independent in production too — see plan.md's cross-repository query note).
func (f *fakeBudgetRepo) seedCategory(c *model.Category) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.categories[c.ID] = c
}

func (f *fakeBudgetRepo) BeginTx(context.Context) (pgx.Tx, error) {
	return &fakeTx{}, nil
}

func (f *fakeBudgetRepo) LockCategoryForBudgetCheck(_ context.Context, _ pgx.Tx, categoryID uuid.UUID) (*model.Category, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	c, ok := f.categories[categoryID]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *c
	return &cp, nil
}

// CreateBudget mirrors idx_budgets_one_active_per_user_category: a second
// active Budget for the same (user, category) loses the race exactly like
// the real partial unique index would.
func (f *fakeBudgetRepo) CreateBudget(_ context.Context, _ pgx.Tx, arg repository.CreateBudgetParams) (*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, b := range f.budgets {
		if b.DeletedAt == nil && b.UserID == arg.UserID && b.CategoryID == arg.CategoryID {
			return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_budgets_one_active_per_user_category"}
		}
	}

	limits := make([]model.BudgetLimit, len(arg.Limits))
	copy(limits, arg.Limits)
	now := time.Now().UTC()
	b := &model.Budget{
		ID:         uuid.New(),
		UserID:     arg.UserID,
		CategoryID: arg.CategoryID,
		Period:     arg.Period,
		StartDate:  arg.StartDate,
		Limits:     limits,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	f.budgets[b.ID] = b
	cp := *b
	cp.Limits = append([]model.BudgetLimit(nil), limits...)
	return &cp, nil
}

func (f *fakeBudgetRepo) ReplaceBudgetLimits(_ context.Context, _ pgx.Tx, budgetID uuid.UUID, limits []model.BudgetLimit) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	b, ok := f.budgets[budgetID]
	if !ok {
		return pgx.ErrNoRows
	}
	b.Limits = append([]model.BudgetLimit(nil), limits...)
	return nil
}

func (f *fakeBudgetRepo) TouchBudgetUpdatedAt(_ context.Context, _ pgx.Tx, id, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	b, ok := f.budgets[id]
	if !ok || b.UserID != userID {
		return pgx.ErrNoRows
	}
	b.UpdatedAt = time.Now().UTC()
	return nil
}

func (f *fakeBudgetRepo) ListBudgetsByUser(_ context.Context, userID uuid.UUID) ([]*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Budget
	for _, b := range f.budgets {
		if b.DeletedAt == nil && b.UserID == userID {
			cp := *b
			cp.Limits = append([]model.BudgetLimit(nil), b.Limits...)
			out = append(out, &cp)
		}
	}
	return out, nil
}

// GetBudgetByID is deliberately NOT scoped by user_id, matching the real
// query — the service layer decides 403 vs. 404.
func (f *fakeBudgetRepo) GetBudgetByID(_ context.Context, id uuid.UUID) (*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	b, ok := f.budgets[id]
	if !ok || b.DeletedAt != nil {
		return nil, pgx.ErrNoRows
	}
	cp := *b
	cp.Limits = append([]model.BudgetLimit(nil), b.Limits...)
	return &cp, nil
}

func (f *fakeBudgetRepo) SoftDeleteBudget(_ context.Context, id, userID uuid.UUID) (*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	b, ok := f.budgets[id]
	if !ok || b.DeletedAt != nil || b.UserID != userID {
		return nil, pgx.ErrNoRows
	}
	now := time.Now().UTC()
	b.DeletedAt = &now
	cp := *b
	return &cp, nil
}

// SpentByUserCurrentPeriod backs BUD-T17's real spend computation — the fake
// returns whatever seedSpend has staged, keyed by category ID then currency,
// same convention as seedCategory. Defaults to an empty map (0 spent
// everywhere) when nothing has been staged.
func (f *fakeBudgetRepo) SpentByUserCurrentPeriod(_ context.Context, _ uuid.UUID) (map[uuid.UUID]map[string]int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.spent == nil {
		return map[uuid.UUID]map[string]int64{}, nil
	}
	return f.spent, nil
}

// seedSpend stages the SpentByUserCurrentPeriod result a test wants —
// BudgetService tests that need a non-zero spent figure call this before
// exercising ListBudgets/GetBudget/UpdateBudget.
func (f *fakeBudgetRepo) seedSpend(categoryID uuid.UUID, currency string, amount int64) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.spent == nil {
		f.spent = make(map[uuid.UUID]map[string]int64)
	}
	if f.spent[categoryID] == nil {
		f.spent[categoryID] = make(map[string]int64)
	}
	f.spent[categoryID][currency] = amount
}
