package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeTx is a no-op stand-in for pgx.Tx — WalletService only ever calls
// Commit/Rollback on it; every other method exists solely to satisfy the
// interface and is never invoked by the code under test.
type fakeTx struct {
	committed bool
}

func (t *fakeTx) Begin(context.Context) (pgx.Tx, error) { return t, nil }

func (t *fakeTx) Commit(context.Context) error {
	t.committed = true
	return nil
}

func (t *fakeTx) Rollback(context.Context) error {
	if t.committed {
		return pgx.ErrTxClosed
	}
	return nil
}

func (t *fakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	panic("fakeTx: CopyFrom is not exercised by WalletService tests")
}
func (t *fakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults {
	panic("fakeTx: SendBatch is not exercised by WalletService tests")
}
func (t *fakeTx) LargeObjects() pgx.LargeObjects {
	panic("fakeTx: LargeObjects is not exercised by WalletService tests")
}
func (t *fakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	panic("fakeTx: Prepare is not exercised by WalletService tests")
}
func (t *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	panic("fakeTx: Exec is not exercised by WalletService tests")
}
func (t *fakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) {
	panic("fakeTx: Query is not exercised by WalletService tests")
}
func (t *fakeTx) QueryRow(context.Context, string, ...any) pgx.Row {
	panic("fakeTx: QueryRow is not exercised by WalletService tests")
}
func (t *fakeTx) Conn() *pgx.Conn {
	panic("fakeTx: Conn is not exercised by WalletService tests")
}

// fakeWalletRepo is an in-memory stand-in for WalletRepo, used instead of a
// real Postgres per Go Test Conventions. Holding f.mu for the whole
// check-then-write span of CreateWallet/SetDefaultWallet is what makes the
// default-uniqueness race tests meaningful without testcontainers-go — same
// approach as fakeUserRepo's ActivateUser (fake_repo_test.go).
type fakeWalletRepo struct {
	mu      sync.Mutex
	wallets map[uuid.UUID]*model.Wallet
	// transactionWallets backs HasTransactionForWallet (WAL-T14) — a set of
	// wallet IDs a test has staged as "has at least one non-deleted
	// Transaction", via seedTransactionForWallet.
	transactionWallets map[uuid.UUID]bool
}

func newFakeWalletRepo() *fakeWalletRepo {
	return &fakeWalletRepo{
		wallets:            make(map[uuid.UUID]*model.Wallet),
		transactionWallets: make(map[uuid.UUID]bool),
	}
}

// seedTransactionForWallet stages HasTransactionForWallet's result for a
// wallet ID — tests exercising the 409 CURRENCY_LOCKED path call this before
// UpdateWallet.
func (f *fakeWalletRepo) seedTransactionForWallet(walletID uuid.UUID) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.transactionWallets[walletID] = true
}

func (f *fakeWalletRepo) HasTransactionForWallet(_ context.Context, walletID uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.transactionWallets[walletID], nil
}

func (f *fakeWalletRepo) BeginTx(context.Context) (pgx.Tx, error) {
	return &fakeTx{}, nil
}

func (f *fakeWalletRepo) CountWalletsByUser(_ context.Context, userID uuid.UUID) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var count int64
	for _, w := range f.wallets {
		if w.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (f *fakeWalletRepo) ClearDefaultWallet(_ context.Context, _ pgx.Tx, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, w := range f.wallets {
		if w.UserID == userID && w.IsDefault {
			w.IsDefault = false
			w.UpdatedAt = time.Now().UTC()
		}
	}
	return nil
}

// CreateWallet mirrors idx_wallets_one_default_per_user: if the caller asks
// for is_default=true while another wallet for the same user already holds
// it (i.e. a concurrent request won the race between our ClearDefaultWallet
// and this call), it fails exactly like the real partial unique index would.
func (f *fakeWalletRepo) CreateWallet(_ context.Context, _ pgx.Tx, arg repository.CreateWalletParams) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if arg.IsDefault {
		for _, w := range f.wallets {
			if w.UserID == arg.UserID && w.IsDefault {
				return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_wallets_one_default_per_user"}
			}
		}
	}

	now := time.Now().UTC()
	w := &model.Wallet{
		ID:        uuid.New(),
		UserID:    arg.UserID,
		Name:      arg.Name,
		Type:      model.WalletType(arg.Type),
		Balance:   arg.Balance,
		Currency:  arg.Currency,
		IsDefault: arg.IsDefault,
		Icon:      arg.Icon,
		IconURL:   arg.IconURL,
		CreatedAt: now,
		UpdatedAt: now,
	}
	f.wallets[w.ID] = w
	cp := *w
	return &cp, nil
}

func (f *fakeWalletRepo) ListWalletsByUser(_ context.Context, userID uuid.UUID) ([]*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Wallet
	for _, w := range f.wallets {
		if w.UserID == userID {
			cp := *w
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDefault != out[j].IsDefault {
			return out[i].IsDefault
		}
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out, nil
}

func (f *fakeWalletRepo) GetWalletByID(_ context.Context, id uuid.UUID) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	w, ok := f.wallets[id]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *w
	return &cp, nil
}

func (f *fakeWalletRepo) UpdateWallet(_ context.Context, arg repository.UpdateWalletParams) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	w, ok := f.wallets[arg.ID]
	if !ok || w.UserID != arg.UserID {
		return nil, pgx.ErrNoRows
	}
	if arg.Name != nil {
		w.Name = *arg.Name
	}
	if arg.Type != nil {
		w.Type = model.WalletType(*arg.Type)
	}
	if arg.Currency != nil {
		w.Currency = *arg.Currency
	}
	if arg.Icon != nil {
		w.Icon = arg.Icon
	}
	// IconURL is only ever applied when IconURLProvided is true — a nil
	// IconURL with IconURLProvided=true means "clear the photo", not "leave
	// it alone" (dto.OptionalString / specs/wallet-budget-icons/plan.md
	// Finding #1), mirroring the real CASE-based SQL exactly.
	if arg.IconURLProvided {
		w.IconURL = arg.IconURL
	}
	w.UpdatedAt = time.Now().UTC()
	cp := *w
	return &cp, nil
}

// SetDefaultWallet mirrors the same unique-index race as CreateWallet, for a
// concurrent set-default targeting a *different* wallet of the same user.
func (f *fakeWalletRepo) SetDefaultWallet(_ context.Context, _ pgx.Tx, id, userID uuid.UUID) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	w, ok := f.wallets[id]
	if !ok || w.UserID != userID {
		return nil, pgx.ErrNoRows
	}
	for _, other := range f.wallets {
		if other.UserID == userID && other.ID != id && other.IsDefault {
			return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_wallets_one_default_per_user"}
		}
	}
	w.IsDefault = true
	w.UpdatedAt = time.Now().UTC()
	cp := *w
	return &cp, nil
}
