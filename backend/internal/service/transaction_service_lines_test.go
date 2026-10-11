package service

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Fixture of S-TXI-02: Items 30,000 + 70,000 VND, tax 8,000 VND, amount 108,000 VND (xu).
func receiptRequest(walletID, categoryID uuid.UUID) dto.CreateTransactionRequest {
	return dto.CreateTransactionRequest{
		WalletID:    walletID,
		CategoryID:  categoryID,
		Amount:      10800000,
		Type:        "expense",
		Items:       []dto.TransactionItemRequest{item("Sữa", 3000000), item("Bánh mì", 7000000)},
		Adjustments: []dto.TransactionAdjustmentRequest{adjustment("tax", 800000)},
	}
}

type linesFixture struct {
	svc      *TransactionService
	txRepo   *fakeTransactionRepo
	userID   uuid.UUID
	wallet   *model.Wallet
	category *model.Category
}

func newLinesFixture(t *testing.T) linesFixture {
	t.Helper()
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	return linesFixture{
		svc:      svc,
		txRepo:   txRepo,
		userID:   userID,
		wallet:   seedTestWallet(t, walletRepo, txRepo, userID, 100000000),
		category: seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense),
	}
}

func (f linesFixture) createReceipt(t *testing.T) *model.Transaction {
	t.Helper()
	created, _, _, err := f.svc.CreateTransaction(context.Background(), f.userID, receiptRequest(f.wallet.ID, f.category.ID))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return created
}

// S-TXI-02: one Transaction, lines stored, balance moved once.
func TestCreateTransaction_WithLines(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	if len(created.Items) != 2 || len(created.Adjustments) != 1 || created.ItemCount != 2 {
		t.Fatalf("expected 2 items + 1 adjustment attached, got %+v", created)
	}
	if got := f.txRepo.balanceOf(f.wallet.ID); got != 100000000-10800000 {
		t.Fatalf("expected balance moved once by the amount, got %d", got)
	}
	entry := f.txRepo.auditLogsFor(created.ID)[0]
	if len(entry.After) == 0 || !containsKey(entry.After, "items") {
		t.Fatalf("expected the create snapshot to carry the items")
	}
}

// S-TXI-04: unexplained gap — nothing written, balance unchanged.
func TestCreateTransaction_MismatchWritesNothing(t *testing.T) {
	f := newLinesFixture(t)
	req := receiptRequest(f.wallet.ID, f.category.ID)
	req.Adjustments = nil
	_, _, _, err := f.svc.CreateTransaction(context.Background(), f.userID, req)
	assertAppErrCode(t, err, common.ErrCodeItemsTotalMismatch)
	if got := f.txRepo.balanceOf(f.wallet.ID); got != 100000000 {
		t.Fatalf("expected balance unchanged, got %d", got)
	}
	if len(f.txRepo.transactions) != 0 {
		t.Fatalf("expected no Transaction written")
	}
}

// S-TXI-09: lines on a transfer.
func TestCreateTransaction_TransferWithLinesRejected(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 500000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 0)
	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: source.ID, ToWalletID: &destination.ID, Amount: 100, Type: "transfer",
		Items: []dto.TransactionItemRequest{item("x", 100)},
	})
	assertAppErrCode(t, err, common.ErrCodeItemsNotAllowed)
}

// S-TXI-12: a replay returns the original lines and writes none.
func TestCreateTransaction_ReplayReturnsOriginalLines(t *testing.T) {
	f := newLinesFixture(t)
	req := receiptRequest(f.wallet.ID, f.category.ID)
	key := uuid.New()
	req.IdempotencyKey = &key
	first, _, _, err := f.svc.CreateTransaction(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	replay, _, wasReplay, err := f.svc.CreateTransaction(context.Background(), f.userID, req)
	if err != nil || !wasReplay || replay.ID != first.ID || len(replay.Items) != 2 {
		t.Fatalf("expected a replay with the original 2 items, got %+v (replay=%v, err=%v)", replay, wasReplay, err)
	}
	if got := f.txRepo.balanceOf(f.wallet.ID); got != 100000000-10800000 {
		t.Fatalf("expected one balance change, got %d", got)
	}
}

// S-TXI-23: Item and amount fixed together — lines replaced, balance moves by the difference.
func TestUpdateTransaction_ReplaceLinesWithAmount(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	items := []dto.TransactionItemRequest{item("Sữa", 3500000), item("Bánh mì", 7000000)}
	adjustments := []dto.TransactionAdjustmentRequest{adjustment("tax", 800000)}
	updated, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Amount: ptr(int64(11300000)), Items: &items, Adjustments: &adjustments,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Items[0].Amount != 3500000 || len(f.txRepo.retiredLines[created.ID]) != 1 {
		t.Fatalf("expected new lines and one retired list, got %+v", updated.Items)
	}
	if got := f.txRepo.balanceOf(f.wallet.ID); got != 100000000-11300000 {
		t.Fatalf("expected balance moved by 5,000 VND once, got %d", got)
	}
}

// S-TXI-24, S-TXI-25: an edit that breaks the total changes nothing.
func TestUpdateTransaction_MismatchRejected(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	_, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Amount: ptr(int64(12000000)),
	})
	assertAppErrCode(t, err, common.ErrCodeItemsTotalMismatch)
	if got := f.txRepo.balanceOf(f.wallet.ID); got != 100000000-10800000 {
		t.Fatalf("expected balance unchanged, got %d", got)
	}
	if len(f.txRepo.lines[created.ID].Items) != 2 {
		t.Fatalf("expected lines untouched")
	}
}

// S-TXI-27: removing every Item leaves a plain Transaction, amount unchanged.
func TestUpdateTransaction_RemoveAllLines(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	empty := []dto.TransactionItemRequest{}
	updated, balance, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{Items: &empty})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.ItemCount != 0 || len(updated.Adjustments) != 0 || balance != nil {
		t.Fatalf("expected plain Transaction and no balance move, got %+v balance=%v", updated, balance)
	}
}

// S-TXI-35 / S-TXI-37: stale copy refused; without the version it saves.
func TestUpdateTransaction_StaleCopy(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	seen := created.UpdatedAt.Format(time.RFC3339Nano)
	f.txRepo.setUpdatedAt(created.ID, created.UpdatedAt.Add(time.Second))

	_, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Note: ptr("đi chợ"), ExpectedUpdatedAt: &seen,
	})
	assertAppErrCode(t, err, common.ErrCodeTransactionChanged)

	if _, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{Note: ptr("đi chợ")}); err != nil {
		t.Fatalf("save anyway must succeed, got %v", err)
	}
}

func TestUpdateTransaction_AdjustmentsWithoutItemsRejected(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)
	adjustments := []dto.TransactionAdjustmentRequest{adjustment("tax", 1)}
	_, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Note: ptr("x"), Adjustments: &adjustments,
	})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
}

// S-TXI-18 / S-TXI-19 / S-TXI-20: list counts, detail lines, cross-user denied.
func TestReadTransactions_ItemCountAndDetail(t *testing.T) {
	f := newLinesFixture(t)
	created := f.createReceipt(t)

	result, err := f.svc.ListTransactions(context.Background(), f.userID, dto.ListTransactionsQuery{})
	if err != nil || len(result.Transactions) != 1 || result.Transactions[0].ItemCount != 2 || result.Transactions[0].Items != nil {
		t.Fatalf("expected one row with item_count 2 and no lines, got %+v err=%v", result.Transactions, err)
	}
	detail, err := f.svc.GetTransaction(context.Background(), f.userID, created.ID)
	if err != nil || len(detail.Items) != 2 || len(detail.Adjustments) != 1 {
		t.Fatalf("expected detail with lines, got %+v err=%v", detail, err)
	}
	_, err = f.svc.GetTransaction(context.Background(), uuid.New(), created.ID)
	assertAppErrCode(t, err, common.ErrCodeTransactionAccessDenied)
}

func containsKey(raw []byte, key string) bool {
	return bytes.Contains(raw, []byte(`"`+key+`"`))
}
