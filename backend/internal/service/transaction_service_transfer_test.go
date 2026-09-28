package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func seedTransferCategory(categoryRepo *fakeCategoryRepo) *model.Category {
	key := model.SystemKeyTransfer
	c := &model.Category{ID: uuid.New(), Name: "Chuyển khoản", Type: model.CategoryTypeTransfer, SystemKey: &key}
	categoryRepo.categories[c.ID] = c
	return c
}

func seedTransferWallet(t *testing.T, walletRepo *fakeWalletRepo, txRepo *fakeTransactionRepo, ownerID uuid.UUID, name, currency string, balance int64) *model.Wallet {
	t.Helper()
	w := &model.Wallet{ID: uuid.New(), UserID: ownerID, Name: name, Type: model.WalletTypeBank, Balance: balance, Currency: currency}
	walletRepo.wallets[w.ID] = w
	txRepo.seedWallet(w)
	return w
}

func TestTransactionService_Transfer_MovesBothBalancesAndUsesSystemCategory(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transferCategory := seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 500000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 100000)

	transaction, balance, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   source.ID,
		ToWalletID: &destination.ID,
		Amount:     200000,
		Type:       "transfer",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance == nil || *balance != 300000 {
		t.Fatalf("expected source balance 300000, got %v", balance)
	}
	if got := txRepo.balanceOf(destination.ID); got != 300000 {
		t.Fatalf("expected destination balance 300000, got %d", got)
	}
	if transaction.CategoryID != transferCategory.ID {
		t.Fatalf("expected the system transfer category, got %s", transaction.CategoryID)
	}
	if transaction.ToWalletName == nil || *transaction.ToWalletName != destination.Name {
		t.Fatalf("expected destination name attached, got %v", transaction.ToWalletName)
	}
}

func TestTransactionService_Transfer_InsufficientSourceBalance(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "A", "VND", 1000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "B", "VND", 0)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: source.ID, ToWalletID: &destination.ID, Amount: 5000, Type: "transfer",
	})
	assertAppErrCode(t, err, common.ErrCodeInsufficientBalance)
	if got := txRepo.balanceOf(destination.ID); got != 0 {
		t.Fatalf("destination must be untouched on a rejected transfer, got %d", got)
	}
}

func TestTransactionService_Transfer_RejectsSameWalletAndCurrencyMismatch(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	vnd := seedTransferWallet(t, walletRepo, txRepo, userID, "VND", "VND", 100000)
	usd := seedTransferWallet(t, walletRepo, txRepo, userID, "USD", "USD", 100000)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: vnd.ID, ToWalletID: &vnd.ID, Amount: 100, Type: "transfer",
	})
	assertAppErrCode(t, err, common.ErrCodeTransferSameWallet)

	_, _, _, err = svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: vnd.ID, ToWalletID: &usd.ID, Amount: 100, Type: "transfer",
	})
	assertAppErrCode(t, err, common.ErrCodeTransferCurrencyMismatch)
}

func TestTransactionService_Transfer_RejectsSomeoneElsesDestination(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "Mine", "VND", 100000)
	theirs := seedTransferWallet(t, walletRepo, txRepo, uuid.New(), "Theirs", "VND", 0)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: source.ID, ToWalletID: &theirs.ID, Amount: 100, Type: "transfer",
	})
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
}

func TestTransactionService_Transfer_UpdateAndDeleteKeepBothSidesInStep(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "A", "VND", 500000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "B", "VND", 0)

	created, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: source.ID, ToWalletID: &destination.ID, Amount: 200000, Type: "transfer",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newAmount := int64(250000)
	if _, _, err := svc.UpdateTransaction(context.Background(), userID, created.ID, dto.UpdateTransactionRequest{Amount: &newAmount}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if a, b := txRepo.balanceOf(source.ID), txRepo.balanceOf(destination.ID); a != 250000 || b != 250000 {
		t.Fatalf("after update expected 250000/250000, got %d/%d", a, b)
	}

	otherCategory := uuid.New()
	_, _, err = svc.UpdateTransaction(context.Background(), userID, created.ID, dto.UpdateTransactionRequest{CategoryID: &otherCategory})
	assertAppErrCode(t, err, common.ErrCodeTransferCategoryImmutable)

	if _, err := svc.DeleteTransaction(context.Background(), userID, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if a, b := txRepo.balanceOf(source.ID), txRepo.balanceOf(destination.ID); a != 500000 || b != 0 {
		t.Fatalf("after delete expected 500000/0, got %d/%d", a, b)
	}
}
