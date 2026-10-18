package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

func (f *imageFixture) saveExpense(walletID uuid.UUID, amountXu int64, occurredAt time.Time, deleted bool) {
	t := &model.Transaction{
		ID: uuid.New(), UserID: f.userID, WalletID: walletID, CategoryID: f.food.ID,
		Amount: amountXu, Type: model.TransactionTypeExpense, OccurredAt: occurredAt,
	}
	if deleted {
		now := imageTestNow
		t.DeletedAt = &now
	}
	f.txRepo.transactions[t.ID] = t
}

func TestImage_PossibleDuplicateIsMarked(t *testing.T) { // S-AIIMG-61
	f := newImageFixture(t, true)
	// 20:30 on 2 Oct in Vietnam is 13:30 UTC — same local day as a receipt dated 02/10.
	saved := time.Date(2026, 10, 2, 13, 30, 0, 0, time.UTC)
	f.saveExpense(f.cash.ID, 14_500_000, saved, false)
	a := f.propose(t, sourceKindReceipt, f.receipt(145000, "2026-10-02")).Actions[0]
	if a.PossibleDuplicate == nil || a.PossibleDuplicate.Amount != 14_500_000 || !a.PossibleDuplicate.OccurredAt.Equal(saved) {
		t.Fatalf("got %+v", a.PossibleDuplicate)
	}
}

func TestImage_NoDuplicateForOtherWalletDayOrDeleted(t *testing.T) { // S-AIIMG-64
	f := newImageFixture(t, true)
	f.saveExpense(uuid.New(), 14_500_000, time.Date(2026, 10, 2, 3, 0, 0, 0, time.UTC), false)
	f.saveExpense(f.cash.ID, 14_500_000, time.Date(2026, 10, 1, 3, 0, 0, 0, time.UTC), false)
	f.saveExpense(f.cash.ID, 14_500_000, time.Date(2026, 10, 2, 3, 0, 0, 0, time.UTC), true)
	f.saveExpense(f.cash.ID, 9_900_000, time.Date(2026, 10, 2, 3, 0, 0, 0, time.UTC), false)
	a := f.propose(t, sourceKindReceipt, f.receipt(145000, "2026-10-02")).Actions[0]
	if a.PossibleDuplicate != nil {
		t.Fatalf("unexpected duplicate %+v", a.PossibleDuplicate)
	}
}

// failingListRepo makes the duplicate lookup fail.
type failingListRepo struct{ *fakeTransactionRepo }

func (failingListRepo) ListTransactionsByUser(context.Context, uuid.UUID, repository.ListTransactionsFilter) ([]*model.Transaction, error) {
	return nil, errors.New("db down")
}

func TestImage_DuplicateLookupFailureNeverFailsTheReply(t *testing.T) {
	f := newImageFixture(t, true)
	f.svc.txRepo = failingListRepo{f.txRepo}
	resp := f.propose(t, sourceKindReceipt, f.receipt(145000, "2026-10-02"))
	if len(resp.Actions) != 1 || resp.Actions[0].PossibleDuplicate != nil {
		t.Fatalf("got %+v", resp.Actions)
	}
}
