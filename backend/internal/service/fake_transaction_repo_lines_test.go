package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/repository"
)

// Lines half of fakeTransactionRepo (specs/transaction-line-items). Like the
// rest of the fake it has no rollback: tests asserting "nothing written"
// assert on error paths that return before the writes, as the service does.

func (f *fakeTransactionRepo) InsertTransactionLines(_ context.Context, _ pgx.Tx, transactionID, _ uuid.UUID, lines repository.TransactionLines) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lines[transactionID] = lines
	return nil
}

func (f *fakeTransactionRepo) ListActiveLines(_ context.Context, _ pgx.Tx, transactionID, userID uuid.UUID) (repository.TransactionLines, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t, ok := f.transactions[transactionID]; ok && t.UserID != userID {
		return emptyLines(), nil
	}
	if lines, ok := f.lines[transactionID]; ok {
		return lines, nil
	}
	return emptyLines(), nil
}

func (f *fakeTransactionRepo) ListActiveLinesByTransactionIDs(_ context.Context, userID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]repository.TransactionLines, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[uuid.UUID]repository.TransactionLines)
	for _, id := range ids {
		t, ok := f.transactions[id]
		lines, has := f.lines[id]
		if ok && has && t.UserID == userID && len(lines.Items)+len(lines.Adjustments) > 0 {
			out[id] = lines
		}
	}
	return out, nil
}

func (f *fakeTransactionRepo) SoftDeleteActiveLines(_ context.Context, _ pgx.Tx, transactionID, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if lines, ok := f.lines[transactionID]; ok {
		f.retiredLines[transactionID] = append(f.retiredLines[transactionID], lines)
		delete(f.lines, transactionID)
	}
	return nil
}

func (f *fakeTransactionRepo) CountActiveItems(_ context.Context, userID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[uuid.UUID]int)
	for _, id := range ids {
		t, ok := f.transactions[id]
		if lines, has := f.lines[id]; ok && has && t.UserID == userID && len(lines.Items) > 0 {
			out[id] = len(lines.Items)
		}
	}
	return out, nil
}

func (f *fakeTransactionRepo) LockTransactionForUpdate(_ context.Context, _ pgx.Tx, transactionID, userID uuid.UUID) (repository.LockedTransaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.transactions[transactionID]
	if !ok || t.DeletedAt != nil || t.UserID != userID {
		return repository.LockedTransaction{}, pgx.ErrNoRows
	}
	return repository.LockedTransaction{
		Amount:     t.Amount,
		UpdatedAt:  t.UpdatedAt,
		WalletID:   t.WalletID,
		Type:       t.Type,
		ToWalletID: t.ToWalletID,
	}, nil
}

// setUpdatedAt simulates an edit saved elsewhere (stale-edit tests).
func (f *fakeTransactionRepo) setUpdatedAt(transactionID uuid.UUID, at time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t, ok := f.transactions[transactionID]; ok {
		t.UpdatedAt = at
	}
}

func emptyLines() repository.TransactionLines {
	return repository.TransactionLines{}
}
