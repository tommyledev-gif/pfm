package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func newTestTransactionService(t *testing.T) (*TransactionService, *fakeTransactionRepo, *fakeWalletRepo, *fakeCategoryRepo) {
	t.Helper()
	txRepo := newFakeTransactionRepo()
	walletRepo := newFakeWalletRepo()
	categoryRepo := newFakeCategoryRepo()
	return NewTransactionService(txRepo, walletRepo, categoryRepo, zap.NewNop()), txRepo, walletRepo, categoryRepo
}

func seedTestWallet(t *testing.T, walletRepo *fakeWalletRepo, txRepo *fakeTransactionRepo, ownerID uuid.UUID, balance int64) *model.Wallet {
	t.Helper()
	w := &model.Wallet{ID: uuid.New(), UserID: ownerID, Name: "Main Wallet", Type: model.WalletTypeCash, Balance: balance, Currency: "VND"}
	walletRepo.wallets[w.ID] = w
	txRepo.seedWallet(w)
	return w
}

func seedTestCategory(categoryRepo *fakeCategoryRepo, ownerID uuid.UUID, name string, categoryType model.CategoryType) *model.Category {
	c := &model.Category{ID: uuid.New(), UserID: &ownerID, Name: name, Type: categoryType}
	categoryRepo.categories[c.ID] = c
	return c
}

func assertAppErrCode(t *testing.T, err error, wantCode string) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != wantCode {
		t.Fatalf("expected %s, got %v", wantCode, err)
	}
}

// S-TRX-01: happy path expense — wallet balance decreases.
func TestTransactionService_CreateTransaction_ExpenseSuccess(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	transaction, balance, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     200000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance == nil || *balance != 800000 {
		t.Fatalf("expected wallet balance 800000, got %v", balance)
	}
	if transaction.WalletName != wallet.Name || transaction.CategoryName != category.Name {
		t.Fatalf("expected denormalized names attached, got %+v", transaction)
	}
}

// S-TRX-02: happy path income — wallet balance increases.
func TestTransactionService_CreateTransaction_IncomeSuccess(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Salary", model.CategoryTypeIncome)

	_, balance, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     500000,
		Type:       "income",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance == nil || *balance != 1500000 {
		t.Fatalf("expected wallet balance 1500000, got %v", balance)
	}
}

// S-TRX-09: an expense that would drive the wallet negative is rejected, and
// the wallet balance is left untouched.
func TestTransactionService_CreateTransaction_InsufficientBalance(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Shopping", model.CategoryTypeExpense)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     2000000,
		Type:       "expense",
	})
	assertAppErrCode(t, err, common.ErrCodeInsufficientBalance)
	if got := txRepo.balanceOf(wallet.ID); got != 1000000 {
		t.Fatalf("expected wallet balance untouched at 1000000, got %d", got)
	}
}

// S-TRX-11: a wallet owned by a different user is a 403, not a 404.
func TestTransactionService_CreateTransaction_WalletAccessDenied(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	ownerID := uuid.New()
	callerID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, ownerID, 1000000)
	category := seedTestCategory(categoryRepo, callerID, "Food", model.CategoryTypeExpense)

	_, _, _, err := svc.CreateTransaction(context.Background(), callerID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     1000,
		Type:       "expense",
	})
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
}

// S-TRX-10: a wallet that doesn't exist is a 404.
func TestTransactionService_CreateTransaction_WalletNotFound(t *testing.T) {
	svc, _, _, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   uuid.New(),
		CategoryID: category.ID,
		Amount:     1000,
		Type:       "expense",
	})
	assertAppErrCode(t, err, common.ErrCodeWalletNotFound)
}

// S-TRX-14: a Transaction's type must match its Category's type.
func TestTransactionService_CreateTransaction_CategoryTypeMismatch(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	salary := seedTestCategory(categoryRepo, userID, "Salary", model.CategoryTypeIncome)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: salary.ID,
		Amount:     1000,
		Type:       "expense",
	})
	assertAppErrCode(t, err, common.ErrCodeCategoryTypeMismatch)
}

// S-TRX-18: two concurrent expense requests against a wallet with exactly
// enough balance for one — exactly one succeeds, the other is rejected, and
// the final balance settles at 0, never negative.
func TestTransactionService_CreateTransaction_ConcurrentInsufficientBalanceRace(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 500000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	var wg sync.WaitGroup
	results := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
				WalletID:   wallet.ID,
				CategoryID: category.ID,
				Amount:     500000,
				Type:       "expense",
			})
			results[idx] = err
		}(i)
	}
	wg.Wait()

	successes, failures := 0, 0
	for _, err := range results {
		if err == nil {
			successes++
		} else {
			failures++
		}
	}
	if successes != 1 || failures != 1 {
		t.Fatalf("expected exactly 1 success and 1 failure, got %d successes, %d failures", successes, failures)
	}
	if got := txRepo.balanceOf(wallet.ID); got != 0 {
		t.Fatalf("expected final balance 0, got %d", got)
	}
}

// S-TRX-32/S-TRX-33: GetTransaction distinguishes access-denied from not-found.
func TestTransactionService_GetTransaction_OwnershipSplit(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	ownerID := uuid.New()
	otherID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, ownerID, 1000000)
	category := seedTestCategory(categoryRepo, ownerID, "Food", model.CategoryTypeExpense)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), ownerID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     100000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error creating transaction: %v", err)
	}

	if _, err := svc.GetTransaction(context.Background(), otherID, transaction.ID); assertErrCodeOrFail(t, err, common.ErrCodeTransactionAccessDenied) {
	}
	if _, err := svc.GetTransaction(context.Background(), ownerID, uuid.New()); assertErrCodeOrFail(t, err, common.ErrCodeTransactionNotFound) {
	}
}

func assertErrCodeOrFail(t *testing.T, err error, wantCode string) bool {
	t.Helper()
	assertAppErrCode(t, err, wantCode)
	return true
}

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
