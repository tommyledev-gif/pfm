package service

import (
	"context"
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
	// idempotencyIndex maps "userID|idempotencyKey" -> transaction ID —
	// mirrors the real partial unique index on (user_id, idempotency_key)
	// without needing an IdempotencyKey field on model.Transaction itself
	// (specs/ai-chat-assistant/plan.md — the field is never exposed in any
	// response, only used to look the row back up).
	idempotencyIndex map[string]uuid.UUID
	// auditLogs records every InsertAuditLog call, in order — lets tests
	// assert both that a successful mutation wrote exactly one entry and that
	// a rejected one wrote none (specs/transaction-audit-log/spec.md
	// S-TAL-05/S-TAL-06). Appended to unconditionally: this fake has no
	// transaction semantics to roll back with, so a test asserting the
	// "rolled back" case must assert on an error path that returns before
	// the audit write is reached at all, which is where the real service
	// places it too.
	auditLogs []repository.InsertAuditLogParams
	// lines holds each Transaction's active lines; retiredLines counts
	// soft-deleted lists (fake_transaction_repo_lines_test.go).
	lines        map[uuid.UUID]repository.TransactionLines
	retiredLines map[uuid.UUID][]repository.TransactionLines
}

func newFakeTransactionRepo() *fakeTransactionRepo {
	return &fakeTransactionRepo{
		transactions:     make(map[uuid.UUID]*model.Transaction),
		wallets:          make(map[uuid.UUID]*model.Wallet),
		idempotencyIndex: make(map[string]uuid.UUID),
		lines:            make(map[uuid.UUID]repository.TransactionLines),
		retiredLines:     make(map[uuid.UUID][]repository.TransactionLines),
	}
}

func (f *fakeTransactionRepo) InsertAuditLog(_ context.Context, _ pgx.Tx, arg repository.InsertAuditLogParams) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.auditLogs = append(f.auditLogs, arg)
	return nil
}

// auditLogsFor returns the entries recorded for one transaction, in order.
func (f *fakeTransactionRepo) auditLogsFor(transactionID uuid.UUID) []repository.InsertAuditLogParams {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []repository.InsertAuditLogParams
	for _, entry := range f.auditLogs {
		if entry.TransactionID == transactionID {
			out = append(out, entry)
		}
	}
	return out
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
		ToWalletID: arg.ToWalletID,
	}
	if arg.Location != nil {
		loc := *arg.Location
		t.Location = &loc
	}
	f.transactions[t.ID] = t
	if arg.IdempotencyKey != nil {
		f.idempotencyIndex[idempotencyIndexKey(arg.UserID, *arg.IdempotencyKey)] = t.ID
	}
	cp := *t
	return &cp, nil
}

// GetTransactionByIdempotencyKey mirrors the real query's pgx.ErrNoRows
// signal for a fresh key (specs/ai-chat-assistant/spec.md S-AI-13). Like the
// real query it matches soft-deleted rows too (BR-OFF-B01).
func (f *fakeTransactionRepo) GetTransactionByIdempotencyKey(_ context.Context, userID, idempotencyKey uuid.UUID) (*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	id, ok := f.idempotencyIndex[idempotencyIndexKey(userID, idempotencyKey)]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	t, ok := f.transactions[id]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *t
	return &cp, nil
}

// ImportedKeyStates mirrors ListIdempotencyKeyStates: present keys only,
// soft-deleted ones included and marked.
func (f *fakeTransactionRepo) ImportedKeyStates(_ context.Context, userID uuid.UUID, keys []uuid.UUID) (map[uuid.UUID]bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	states := make(map[uuid.UUID]bool, len(keys))
	for _, key := range keys {
		id, ok := f.idempotencyIndex[idempotencyIndexKey(userID, key)]
		if !ok {
			continue
		}
		if t, ok := f.transactions[id]; ok {
			states[key] = t.DeletedAt != nil
		}
	}
	return states, nil
}

func idempotencyIndexKey(userID, idempotencyKey uuid.UUID) string {
	return userID.String() + "|" + idempotencyKey.String()
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
	if arg.WalletID != nil {
		t.WalletID = *arg.WalletID
	}
	// Mirrors the real CASE: a type rewrites the destination with it.
	if arg.Type != nil {
		t.Type = model.TransactionType(*arg.Type)
		t.ToWalletID = nil
		if t.Type == model.TransactionTypeTransfer && arg.ToWalletID != nil {
			to := *arg.ToWalletID
			t.ToWalletID = &to
		}
	}
	if arg.OccurredAt != nil {
		t.OccurredAt = *arg.OccurredAt
	}
	if arg.Note != nil {
		t.Note = arg.Note
	}
	// Mirrors the real move: non-nil lat/lng replace the position, and the
	// place name with it ("" = NULL), or give a pin-less Transaction its pin.
	// Applied before the note: the real UPDATE sets both in one statement, so
	// a note sent with a new pin lands on it.
	if arg.LocationLat != nil && arg.LocationLng != nil {
		loc := model.TransactionLocation{}
		if t.Location != nil {
			loc = *t.Location
		}
		loc.Latitude = *arg.LocationLat
		loc.Longitude = *arg.LocationLng
		loc.PlaceName = nil
		if arg.LocationName != nil && *arg.LocationName != "" {
			name := *arg.LocationName
			loc.PlaceName = &name
		}
		t.Location = &loc
	}
	// Mirrors the real CASE: nil = unchanged, "" = NULL. Replaces Location
	// rather than mutating it — copies handed out earlier share the pointer.
	if arg.LocationNote != nil && t.Location != nil {
		loc := *t.Location
		loc.Note = nil
		if *arg.LocationNote != "" {
			note := *arg.LocationNote
			loc.Note = &note
		}
		t.Location = &loc
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
