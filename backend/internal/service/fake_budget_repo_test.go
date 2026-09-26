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
	// spent backs SpentByUserInWindow (BUD-T17) — nil until a test
	// calls seedSpend, in which case ListBudgets/GetBudget/UpdateBudget see
	// 0 for every currency, matching a real caller with no Transactions yet.
	spent map[uuid.UUID]map[string]int64
	// lastWindow records the window SpentByUserInWindow was last called with,
	// so tests can assert the service resolved the cycle rather than the
	// fake returning seeded spend for any window.
	lastWindow CycleWindow
	// userLocks counts LockUserForBudgetReplace calls (I-4 race guard).
	userLocks int
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
		Icon:       arg.Icon,
		IconURL:    arg.IconURL,
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

// UpdateBudgetFields superseded TouchBudgetUpdatedAt
// (specs/wallet-budget-icons/plan.md Finding #1) — applies icon/icon_url
// (icon_url only when IconURLProvided, same presence-flag semantics as the
// real CASE-based SQL) and always bumps updated_at.
func (f *fakeBudgetRepo) UpdateBudgetFields(_ context.Context, _ pgx.Tx, arg repository.UpdateBudgetFieldsParams) (*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	b, ok := f.budgets[arg.ID]
	if !ok || b.UserID != arg.UserID {
		return nil, pgx.ErrNoRows
	}
	if arg.Icon != nil {
		b.Icon = arg.Icon
	}
	if arg.IconURLProvided {
		b.IconURL = arg.IconURL
	}
	b.UpdatedAt = time.Now().UTC()
	cp := *b
	return &cp, nil
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

// SpentByUserInWindow backs BUD-T17's real spend computation — the fake
// returns whatever seedSpend has staged, keyed by category ID then currency,
// same convention as seedCategory. Defaults to an empty map (0 spent
// everywhere) when nothing has been staged.
func (f *fakeBudgetRepo) SpentByUserInWindow(_ context.Context, _ uuid.UUID, from, to time.Time) (map[uuid.UUID]map[string]int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.lastWindow = CycleWindow{Start: from, End: to}

	if f.spent == nil {
		return map[uuid.UUID]map[string]int64{}, nil
	}
	return f.spent, nil
}

// ListDistinctUserIDsWithActiveBudgets backs NotificationService's
// EvaluateBudgets job (specs/notification-handling/plan.md Finding #1).
func (f *fakeBudgetRepo) ListDistinctUserIDsWithActiveBudgets(_ context.Context) ([]uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	seen := make(map[uuid.UUID]bool)
	var userIDs []uuid.UUID
	for _, b := range f.budgets {
		if b.DeletedAt == nil && !seen[b.UserID] {
			seen[b.UserID] = true
			userIDs = append(userIDs, b.UserID)
		}
	}
	return userIDs, nil
}

// LockUserForBudgetReplace only counts calls — the fake has no concurrency.
func (f *fakeBudgetRepo) LockUserForBudgetReplace(_ context.Context, _ pgx.Tx, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.userLocks++
	return nil
}

// LockBudgetsByUser backs BulkReplaceBudgets (specs/ai-budget-wizard) — the
// fake ignores locking semantics (single-goroutine tests) and just returns
// every one of userID's non-deleted Budgets, same scoping as
// ListBudgetsByUser.
func (f *fakeBudgetRepo) LockBudgetsByUser(_ context.Context, _ pgx.Tx, userID uuid.UUID) ([]*model.Budget, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Budget
	for _, b := range f.budgets {
		if b.DeletedAt == nil && b.UserID == userID {
			cp := *b
			out = append(out, &cp)
		}
	}
	return out, nil
}

// SoftDeleteBudgetsByUser backs BulkReplaceBudgets.
func (f *fakeBudgetRepo) SoftDeleteBudgetsByUser(_ context.Context, _ pgx.Tx, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	now := time.Now().UTC()
	for _, b := range f.budgets {
		if b.DeletedAt == nil && b.UserID == userID {
			b.DeletedAt = &now
		}
	}
	return nil
}

// DeleteBudgetLimitsByBudgetIDs backs BulkReplaceBudgets — the fake clears
// the in-memory Limits slice for each targeted Budget, mirroring the real
// batched DELETE.
func (f *fakeBudgetRepo) DeleteBudgetLimitsByBudgetIDs(_ context.Context, _ pgx.Tx, budgetIDs []uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, id := range budgetIDs {
		if b, ok := f.budgets[id]; ok {
			b.Limits = nil
		}
	}
	return nil
}

// seedSpend stages the SpentByUserInWindow result a test wants —
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
