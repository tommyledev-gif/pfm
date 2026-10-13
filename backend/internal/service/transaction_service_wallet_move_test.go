package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// PATCH wallet_id (transaction_service_wallet_move.go): the old Wallet gets
// the effect back, the new one takes it, in the same tx as the row update.

func createMoveFixture(t *testing.T, txType string, amount int64) (*TransactionService, *fakeTransactionRepo, *fakeWalletRepo, uuid.UUID, *model.Wallet, *model.Wallet, *model.Transaction) {
	t.Helper()
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	from := seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 1000000)
	to := seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 500000)
	category := seedTestCategory(categoryRepo, userID, "Ăn uống", model.CategoryType(txType))

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   from.ID,
		CategoryID: category.ID,
		Amount:     amount,
		Type:       txType,
	})
	if err != nil {
		t.Fatalf("seed create: %v", err)
	}
	return svc, txRepo, walletRepo, userID, from, to, transaction
}

func TestUpdateTransaction_WalletMove_ExpenseMovesBalance(t *testing.T) {
	svc, txRepo, _, userID, from, to, transaction := createMoveFixture(t, "expense", 200000)

	updated, balance, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &to.ID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := txRepo.balanceOf(from.ID); got != 1000000 {
		t.Fatalf("old wallet should get the expense back: want 1000000, got %d", got)
	}
	if got := txRepo.balanceOf(to.ID); got != 300000 {
		t.Fatalf("new wallet should take the expense: want 300000, got %d", got)
	}
	if balance == nil || *balance != 300000 {
		t.Fatalf("response balance should be the new wallet's 300000, got %v", balance)
	}
	if updated.WalletID != to.ID || updated.WalletName != to.Name {
		t.Fatalf("expected the transaction on %s (%s), got %s (%s)", to.ID, to.Name, updated.WalletID, updated.WalletName)
	}

	entries := txRepo.auditLogsFor(transaction.ID)
	last := entries[len(entries)-1]
	before, after := decodeAuditSide(t, last.Before), decodeAuditSide(t, last.After)
	if last.Action != model.AuditActionUpdate || before["wallet_id"] != from.ID.String() || after["wallet_id"] != to.ID.String() {
		t.Fatalf("expected an update entry from %s to %s, got %+v / %+v", from.ID, to.ID, before, after)
	}
}

func TestUpdateTransaction_WalletMove_IncomeMovesBalance(t *testing.T) {
	svc, txRepo, _, userID, from, to, transaction := createMoveFixture(t, "income", 100000)

	if _, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &to.ID}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := txRepo.balanceOf(from.ID); got != 1000000 {
		t.Fatalf("old wallet should give the income back: want 1000000, got %d", got)
	}
	if got := txRepo.balanceOf(to.ID); got != 600000 {
		t.Fatalf("new wallet should take the income: want 600000, got %d", got)
	}
}

// The old Wallet gets the OLD amount back, the new one takes the NEW amount.
func TestUpdateTransaction_WalletMove_WithAmountChange(t *testing.T) {
	svc, txRepo, _, userID, from, to, transaction := createMoveFixture(t, "expense", 200000)
	amount := int64(250000)

	_, balance, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &to.ID, Amount: &amount})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := txRepo.balanceOf(from.ID); got != 1000000 {
		t.Fatalf("old wallet: want 1000000, got %d", got)
	}
	if got := txRepo.balanceOf(to.ID); got != 250000 {
		t.Fatalf("new wallet: want 250000, got %d", got)
	}
	if balance == nil || *balance != 250000 {
		t.Fatalf("response balance: want 250000, got %v", balance)
	}
}

// Naming the Wallet it is already on is not a move: no balance is touched.
func TestUpdateTransaction_WalletMove_SameWalletIsNoOp(t *testing.T) {
	svc, txRepo, _, userID, from, _, transaction := createMoveFixture(t, "expense", 200000)

	_, balance, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &from.ID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance != nil {
		t.Fatalf("expected no balance in the response, got %d", *balance)
	}
	if got := txRepo.balanceOf(from.ID); got != 800000 {
		t.Fatalf("wallet balance should be untouched at 800000, got %d", got)
	}
}

func assertMoveRejected(t *testing.T, txRepo *fakeTransactionRepo, transactionID uuid.UUID, wallets map[uuid.UUID]int64) {
	t.Helper()
	for id, want := range wallets {
		if got := txRepo.balanceOf(id); got != want {
			t.Fatalf("wallet %s balance should be untouched at %d, got %d", id, want, got)
		}
	}
	for _, entry := range txRepo.auditLogsFor(transactionID) {
		if entry.Action == model.AuditActionUpdate {
			t.Fatal("a rejected move must not write an update entry")
		}
	}
}

func TestUpdateTransaction_WalletMove_OtherUsersWalletRejected(t *testing.T) {
	svc, txRepo, walletRepo, userID, from, _, transaction := createMoveFixture(t, "expense", 200000)
	foreign := seedTransferWallet(t, walletRepo, txRepo, uuid.New(), "Ví người khác", "VND", 700000)

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &foreign.ID})
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
	assertMoveRejected(t, txRepo, transaction.ID, map[uuid.UUID]int64{from.ID: 800000, foreign.ID: 700000})
}

func TestUpdateTransaction_WalletMove_MissingWalletRejected(t *testing.T) {
	svc, txRepo, _, userID, from, _, transaction := createMoveFixture(t, "expense", 200000)
	missing := uuid.New()

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &missing})
	assertAppErrCode(t, err, common.ErrCodeWalletNotFound)
	assertMoveRejected(t, txRepo, transaction.ID, map[uuid.UUID]int64{from.ID: 800000})
}

func TestUpdateTransaction_WalletMove_CurrencyMismatchRejected(t *testing.T) {
	svc, txRepo, walletRepo, userID, from, _, transaction := createMoveFixture(t, "expense", 200000)
	usd := seedTransferWallet(t, walletRepo, txRepo, userID, "USD", "USD", 5000)

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{WalletID: &usd.ID})
	assertAppErrCode(t, err, common.ErrCodeWalletCurrencyMismatch)
	assertMoveRejected(t, txRepo, transaction.ID, map[uuid.UUID]int64{from.ID: 800000, usd.ID: 5000})
}

func TestUpdateTransaction_WalletMove_TransferRejected(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 500000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 100000)
	other := seedTransferWallet(t, walletRepo, txRepo, userID, "MoMo", "VND", 0)
	transfer, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   source.ID,
		ToWalletID: &destination.ID,
		Amount:     200000,
		Type:       "transfer",
	})
	if err != nil {
		t.Fatalf("seed transfer: %v", err)
	}

	_, _, err = svc.UpdateTransaction(context.Background(), userID, transfer.ID, dto.UpdateTransactionRequest{WalletID: &other.ID})
	assertAppErrCode(t, err, common.ErrCodeTransferWalletImmutable)
	assertMoveRejected(t, txRepo, transfer.ID, map[uuid.UUID]int64{source.ID: 300000, destination.ID: 300000, other.ID: 0})
}
