package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeTransactionRepo is an in-memory stand-in for TransactionRepo, used
// instead of a real Postgres per Go Test Conventions — same approach as
// fakeWalletRepo/fakeCategoryRepo/fakeBudgetRepo. Holds its own tiny
// wallets map (seeded via seedWallet) so DecrementWalletBalanceIfSufficient/
// AdjustWalletBalance can mutate a real balance figure and return it,
// mirroring the real cross-repository query exception
// (specs/transaction-management/plan.md Security & Actor Resolution) without
// needing a shared fakeWalletRepo instance — TransactionService's own
// WalletRepo dependency is a separate fakeWalletRepo in tests, exactly like
// production's separate WalletRepository.
type fakeTransactionRepo struct {
	mu           sync.Mutex
	transactions map[uuid.UUID]*model.Transaction
	wallets      map[uuid.UUID]*model.Wallet
}

func newFakeTransactionRepo() *fakeTransactionRepo {
	return &fakeTransactionRepo{
		transactions: make(map[uuid.UUID]*model.Transaction),
		wallets:      make(map[uuid.UUID]*model.Wallet),
	}
}

// seedWallet stages a wallet balance this fake's balance-mutation methods
// operate on — independent of the WalletRepo fake TransactionService also
// holds for ownership checks, same as production's separate repositories.
func (f *fakeTransactionRepo) seedWallet(w *model.Wallet) {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := *w
	f.wallets[w.ID] = &cp
}

func (f *fakeTransactionRepo) balanceOf(walletID uuid.UUID) int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	if w, ok := f.wallets[walletID]; ok {
		return w.Balance
	}
	return 0
}

func (f *fakeTransactionRepo) BeginTx(context.Context) (pgx.Tx, error) {
	return &fakeTx{}, nil
}

func (f *fakeTransactionRepo) CreateTransaction(_ context.Context, _ pgx.Tx, arg repository.CreateTransactionParams) (*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	now := time.Now().UTC()
	t := &model.Transaction{
		ID:         uuid.New(),
		UserID:     arg.UserID,
		WalletID:   arg.WalletID,
		CategoryID: arg.CategoryID,
		Amount:     arg.Amount,
		Type:       model.TransactionType(arg.Type),
		Note:       arg.Note,
		OccurredAt: arg.OccurredAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	f.transactions[t.ID] = t
	cp := *t
	return &cp, nil
}

// DecrementWalletBalanceIfSufficient mirrors the real conditional UPDATE —
// returns pgx.ErrNoRows when the wallet's balance is insufficient, the
// authoritative INSUFFICIENT_BALANCE signal (spec.md Context #4).
func (f *fakeTransactionRepo) DecrementWalletBalanceIfSufficient(_ context.Context, _ pgx.Tx, walletID uuid.UUID, amount int64) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	w, ok := f.wallets[walletID]
	if !ok || w.Balance < amount {
		return nil, pgx.ErrNoRows
	}
	w.Balance -= amount
	w.UpdatedAt = time.Now().UTC()
	cp := *w
	return &cp, nil
}

// AdjustWalletBalance is unconditional — no floor check (spec.md Context #3);
// the resulting balance may land at zero or below.
func (f *fakeTransactionRepo) AdjustWalletBalance(_ context.Context, _ pgx.Tx, walletID uuid.UUID, delta int64) (*model.Wallet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	w, ok := f.wallets[walletID]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	w.Balance += delta
	w.UpdatedAt = time.Now().UTC()
	cp := *w
	return &cp, nil
}

// GetTransactionByID is deliberately NOT scoped by user_id, matching the
// real query — the service layer decides 403 vs. 404.
func (f *fakeTransactionRepo) GetTransactionByID(_ context.Context, id uuid.UUID) (*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	t, ok := f.transactions[id]
	if !ok || t.DeletedAt != nil {
		return nil, pgx.ErrNoRows
	}
	cp := *t
	return &cp, nil
}

// ListTransactionsByUser applies every filter and the occurred_at-keyed
// cursor tie-break in plain Go, mirroring the real SQL WHERE clause
// (db/queries/transactions.sql) closely enough for these tests' purposes.
func (f *fakeTransactionRepo) ListTransactionsByUser(_ context.Context, userID uuid.UUID, filter repository.ListTransactionsFilter) ([]*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Transaction
	for _, t := range f.transactions {
		if t.DeletedAt != nil || t.UserID != userID {
			continue
		}
		if filter.WalletID != nil && t.WalletID != *filter.WalletID {
			continue
		}
		if filter.CategoryID != nil && t.CategoryID != *filter.CategoryID {
			continue
		}
		if filter.Type != nil && string(t.Type) != *filter.Type {
			continue
		}
		if filter.From != nil && t.OccurredAt.Before(*filter.From) {
			continue
		}
		if filter.To != nil && t.OccurredAt.After(*filter.To) {
			continue
		}
		if filter.CursorOccurredAt != nil {
			cursorTs := *filter.CursorOccurredAt
			if !(t.OccurredAt.Before(cursorTs) || (t.OccurredAt.Equal(cursorTs) && filter.CursorID != nil && t.ID.String() < filter.CursorID.String())) {
				continue
			}
		}
		cp := *t
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].OccurredAt.Equal(out[j].OccurredAt) {
			return out[i].OccurredAt.After(out[j].OccurredAt)
		}
		return out[i].ID.String() > out[j].ID.String()
	})
	limit := int(filter.Limit)
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (f *fakeTransactionRepo) UpdateTransaction(_ context.Context, _ pgx.Tx, arg repository.UpdateTransactionParams) (*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	t, ok := f.transactions[arg.ID]
	if !ok || t.DeletedAt != nil || t.UserID != arg.UserID {
		return nil, pgx.ErrNoRows
	}
	if arg.Amount != nil {
		t.Amount = *arg.Amount
	}
	if arg.CategoryID != nil {
		t.CategoryID = *arg.CategoryID
	}
	if arg.OccurredAt != nil {
		t.OccurredAt = *arg.OccurredAt
	}
	if arg.Note != nil {
		t.Note = arg.Note
	}
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	return &cp, nil
}

func (f *fakeTransactionRepo) SoftDeleteTransaction(_ context.Context, _ pgx.Tx, id, userID uuid.UUID) (*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	t, ok := f.transactions[id]
	if !ok || t.DeletedAt != nil || t.UserID != userID {
		return nil, pgx.ErrNoRows
	}
	now := time.Now().UTC()
	t.DeletedAt = &now
	cp := *t
	return &cp, nil
}
