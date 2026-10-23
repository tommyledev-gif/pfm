package service

import (
	"context"

	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// S-TRX-38: reducing an income Transaction's amount below what has since
// been spent is allowed and leaves the wallet balance negative — the
// insufficient-balance floor does NOT apply to Update.
func TestTransactionService_UpdateTransaction_AmountChangeAllowsNegativeBalance(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	salary := seedTestCategory(categoryRepo, userID, "Salary", model.CategoryTypeIncome)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: salary.ID,
		Amount:     500000,
		Type:       "income",
	})
	if err != nil {
		t.Fatalf("unexpected error creating transaction: %v", err)
	}
	// Simulate having since spent it all down to 100,000.
	txRepo.wallets[wallet.ID].Balance = 100000

	newAmount := int64(100000)
	_, balance, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Amount: &newAmount,
	})
	if err != nil {
		t.Fatalf("expected update to succeed even though it drives balance negative, got %v", err)
	}
	if balance == nil || *balance != -300000 {
		t.Fatalf("expected wallet balance -300000, got %v", balance)
	}
}

// S-TRX-40: changing category_id on Update must still match the
// Transaction's own immutable type.
func TestTransactionService_UpdateTransaction_CategoryTypeMismatch(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	food := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	salary := seedTestCategory(categoryRepo, userID, "Salary", model.CategoryTypeIncome)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: food.ID,
		Amount:     100000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error creating transaction: %v", err)
	}

	_, _, err = svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		CategoryID: &salary.ID,
	})
	assertAppErrCode(t, err, common.ErrCodeCategoryTypeMismatch)
}

// S-TRX-46: an empty PATCH body is a client mistake, not a no-op 200.
func TestTransactionService_UpdateTransaction_EmptyBodyRejected(t *testing.T) {
	svc, _, _, _ := newTestTransactionService(t)
	_, _, err := svc.UpdateTransaction(context.Background(), uuid.New(), uuid.New(), dto.UpdateTransactionRequest{})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
}

// S-TRX-48/S-TRX-50: deleting an expense gives the money back; deleting an
// income whose funds have since been spent is allowed and leaves the wallet
// balance negative — the insufficient-balance floor does NOT apply to Delete.
func TestTransactionService_DeleteTransaction_ReversesBalance(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	food := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: food.ID,
		Amount:     200000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error creating transaction: %v", err)
	}

	wallet2, err := svc.DeleteTransaction(context.Background(), userID, transaction.ID)
	if err != nil {
		t.Fatalf("unexpected error deleting transaction: %v", err)
	}
	if wallet2.Balance != 1000000 {
		t.Fatalf("expected balance restored to 1000000, got %d", wallet2.Balance)
	}

	// A second delete is a 404, not idempotent-success (S-TRX-52).
	_, err = svc.DeleteTransaction(context.Background(), userID, transaction.ID)
	assertAppErrCode(t, err, common.ErrCodeTransactionNotFound)
}

// specs/ai-chat-assistant/spec.md S-AI-12/S-AI-13: a fresh idempotency_key
// creates normally (wasReplay=false); reusing that same key returns the
// original Transaction (wasReplay=true) without a second balance mutation.
func TestTransactionService_CreateTransaction_IdempotencyKeyReplay(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	key := uuid.New()

	req := dto.CreateTransactionRequest{
		WalletID:       wallet.ID,
		CategoryID:     category.ID,
		Amount:         200000,
		Type:           "expense",
		IdempotencyKey: &key,
	}

	first, balance1, wasReplay1, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}
	if wasReplay1 {
		t.Fatalf("expected wasReplay=false on a fresh key")
	}
	if balance1 == nil || *balance1 != 800000 {
		t.Fatalf("expected balance 800000 after first create, got %v", balance1)
	}

	second, balance2, wasReplay2, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("unexpected error on replayed create: %v", err)
	}
	if !wasReplay2 {
		t.Fatalf("expected wasReplay=true on a reused key")
	}
	if second.ID != first.ID {
		t.Fatalf("expected the same Transaction returned, got a different ID")
	}
	// Nothing was mutated on a replay — nil, not a snapshotted figure,
	// matching UpdateTransaction's own "nil means untouched" convention.
	if balance2 != nil {
		t.Fatalf("expected nil balance on replay (nothing mutated), got %v", *balance2)
	}
	if got := txRepo.balanceOf(wallet.ID); got != 800000 {
		t.Fatalf("expected wallet balance decremented only once, got %d", got)
	}
}

// Every pre-existing call site omits IdempotencyKey — confirms wasReplay is
// always false and behavior is completely unchanged (plan.md Regression
// Scope).
func TestTransactionService_CreateTransaction_NoIdempotencyKey_NeverReplay(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	req := dto.CreateTransactionRequest{WalletID: wallet.ID, CategoryID: category.ID, Amount: 100000, Type: "expense"}

	_, _, wasReplay1, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if wasReplay1 {
		t.Fatalf("expected wasReplay=false with no idempotency key")
	}

	_, _, wasReplay2, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if wasReplay2 {
		t.Fatalf("expected wasReplay=false on a second call with no key — must create a second Transaction, not replay")
	}
	if got := txRepo.balanceOf(wallet.ID); got != 800000 {
		t.Fatalf("expected wallet balance decremented twice (no dedup without a key), got %d", got)
	}
}

// S-TRX-17: omitting occurred_at defaults to "now" rather than failing.
func TestTransactionService_CreateTransaction_DefaultsOccurredAtToNow(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	before := time.Now().UTC()
	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     1000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if transaction.OccurredAt.Before(before.Add(-time.Second)) {
		t.Fatalf("expected occurred_at to default to now, got %v (before %v)", transaction.OccurredAt, before)
	}
}
