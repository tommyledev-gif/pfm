package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// PATCH type (transaction_service_retype.go): the old effect comes off every
// Wallet it touched and the new one goes on, in the tx that rewrites the row.

type retypeFixture struct {
	svc        *TransactionService
	txRepo     *fakeTransactionRepo
	walletRepo *fakeWalletRepo
	userID     uuid.UUID
	from       *model.Wallet // 1,000,000 before the seeded Transaction
	to         *model.Wallet // 500,000 before the seeded Transaction
	expense    *model.Category
	income     *model.Category
	transfer   *model.Category
}

func newRetypeFixture(t *testing.T) retypeFixture {
	t.Helper()
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	return retypeFixture{
		svc:        svc,
		txRepo:     txRepo,
		walletRepo: walletRepo,
		userID:     userID,
		from:       seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 1000000),
		to:         seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 500000),
		expense:    seedTestCategory(categoryRepo, userID, "Ăn uống", model.CategoryTypeExpense),
		income:     seedTestCategory(categoryRepo, userID, "Lương", model.CategoryTypeIncome),
		transfer:   seedTransferCategory(categoryRepo),
	}
}

func (f retypeFixture) create(t *testing.T, req dto.CreateTransactionRequest) *model.Transaction {
	t.Helper()
	created, _, _, err := f.svc.CreateTransaction(context.Background(), f.userID, req)
	if err != nil {
		t.Fatalf("seed create: %v", err)
	}
	return created
}

func (f retypeFixture) expense200k(t *testing.T) *model.Transaction {
	return f.create(t, dto.CreateTransactionRequest{WalletID: f.from.ID, CategoryID: f.expense.ID, Amount: 200000, Type: "expense"})
}

func (f retypeFixture) wantBalances(t *testing.T, from, to int64) {
	t.Helper()
	if got := f.txRepo.balanceOf(f.from.ID); got != from {
		t.Fatalf("source wallet: want %d, got %d", from, got)
	}
	if got := f.txRepo.balanceOf(f.to.ID); got != to {
		t.Fatalf("other wallet: want %d, got %d", to, got)
	}
}

func TestUpdateTransaction_Retype_ExpenseToIncome(t *testing.T) {
	f := newRetypeFixture(t)
	created := f.expense200k(t)

	updated, balance, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Type: ptr("income"), CategoryID: &f.income.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 1,000,000 − 200,000 spent, then the spending taken back and 200,000 received.
	f.wantBalances(t, 1200000, 500000)
	if balance == nil || *balance != 1200000 {
		t.Fatalf("response balance: want 1200000, got %v", balance)
	}
	if updated.Type != model.TransactionTypeIncome || updated.CategoryID != f.income.ID || updated.CategoryName != f.income.Name {
		t.Fatalf("expected an income under %s, got %s under %s (%s)", f.income.Name, updated.Type, updated.CategoryID, updated.CategoryName)
	}

	entries := f.txRepo.auditLogsFor(created.ID)
	before, after := decodeAuditSide(t, entries[len(entries)-1].Before), decodeAuditSide(t, entries[len(entries)-1].After)
	if before["type"] != "expense" || after["type"] != "income" || after["category_id"] != f.income.ID.String() {
		t.Fatalf("expected the type change logged, got %+v / %+v", before, after)
	}
	if _, ok := after["to_wallet_id"]; ok {
		t.Fatalf("no destination on either side, none should be logged: %+v", after)
	}
}

func TestUpdateTransaction_Retype_ExpenseToTransfer(t *testing.T) {
	f := newRetypeFixture(t)
	created := f.expense200k(t)

	updated, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Type: ptr("transfer"), ToWalletID: &f.to.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The source pays the same either way; the destination now receives it.
	f.wantBalances(t, 800000, 700000)
	if updated.Type != model.TransactionTypeTransfer || updated.CategoryID != f.transfer.ID {
		t.Fatalf("expected a transfer under the system category, got %s under %s", updated.Type, updated.CategoryID)
	}
	if updated.ToWalletID == nil || *updated.ToWalletID != f.to.ID || updated.ToWalletName == nil || *updated.ToWalletName != f.to.Name {
		t.Fatalf("expected the destination %s, got %v (%v)", f.to.ID, updated.ToWalletID, updated.ToWalletName)
	}

	entries := f.txRepo.auditLogsFor(created.ID)
	before, after := decodeAuditSide(t, entries[len(entries)-1].Before), decodeAuditSide(t, entries[len(entries)-1].After)
	if before["to_wallet_id"] != nil || after["to_wallet_id"] != f.to.ID.String() {
		t.Fatalf("expected the destination logged, got %+v / %+v", before, after)
	}
	if before["category_id"] != f.expense.ID.String() || after["category_id"] != f.transfer.ID.String() {
		t.Fatalf("expected the implied category change logged, got %+v / %+v", before, after)
	}
}

func TestUpdateTransaction_Retype_TransferToExpense(t *testing.T) {
	f := newRetypeFixture(t)
	created := f.create(t, dto.CreateTransactionRequest{WalletID: f.from.ID, ToWalletID: &f.to.ID, Amount: 200000, Type: "transfer"})
	f.wantBalances(t, 800000, 700000)

	updated, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Type: ptr("expense"), CategoryID: &f.expense.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The destination gives back what it received; the source still paid.
	f.wantBalances(t, 800000, 500000)
	if updated.Type != model.TransactionTypeExpense || updated.ToWalletID != nil || updated.ToWalletName != nil {
		t.Fatalf("expected a plain expense, got %s → %v (%v)", updated.Type, updated.ToWalletID, updated.ToWalletName)
	}
}

// Becoming income on another Wallet in the same PATCH: each Wallet nets out once.
func TestUpdateTransaction_Retype_WithWalletMoveAndAmount(t *testing.T) {
	f := newRetypeFixture(t)
	created := f.expense200k(t)

	_, balance, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Type: ptr("income"), CategoryID: &f.income.ID, WalletID: &f.to.ID, Amount: ptr(int64(300000)),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	f.wantBalances(t, 1000000, 800000)
	if balance == nil || *balance != 800000 {
		t.Fatalf("response balance should be the new wallet's 800000, got %v", balance)
	}
}

func TestUpdateTransaction_Retype_ToTransferDropsItems(t *testing.T) {
	f := newRetypeFixture(t)
	created := f.create(t, dto.CreateTransactionRequest{
		WalletID: f.from.ID, CategoryID: f.expense.ID, Amount: 200000, Type: "expense",
		Items: []dto.TransactionItemRequest{item("Phở", 120000), item("Trà đá", 80000)},
	})

	updated, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, created.ID, dto.UpdateTransactionRequest{
		Type: ptr("transfer"), ToWalletID: &f.to.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(updated.Items) != 0 || len(f.txRepo.lines[created.ID].Items) != 0 {
		t.Fatalf("a transfer has no items, got %+v", updated.Items)
	}
}

func TestUpdateTransaction_Retype_Refusals(t *testing.T) {
	f := newRetypeFixture(t)
	expense := f.expense200k(t)
	transfer := f.create(t, dto.CreateTransactionRequest{WalletID: f.from.ID, ToWalletID: &f.to.ID, Amount: 100000, Type: "transfer"})
	other := seedTransferWallet(t, f.walletRepo, f.txRepo, f.userID, "Momo", "VND", 0)

	cases := []struct {
		name string
		id   uuid.UUID
		req  dto.UpdateTransactionRequest
		code string
	}{
		{"no category for the new type", expense.ID, dto.UpdateTransactionRequest{Type: ptr("income")}, common.ErrCodeInvalidInput},
		{"category of the old type", expense.ID, dto.UpdateTransactionRequest{Type: ptr("income"), CategoryID: &f.expense.ID}, common.ErrCodeCategoryTypeMismatch},
		{"transfer without a destination", expense.ID, dto.UpdateTransactionRequest{Type: ptr("transfer")}, common.ErrCodeInvalidInput},
		{"transfer to its own wallet", expense.ID, dto.UpdateTransactionRequest{Type: ptr("transfer"), ToWalletID: &f.from.ID}, common.ErrCodeTransferSameWallet},
		{"transfer with a category", expense.ID, dto.UpdateTransactionRequest{Type: ptr("transfer"), ToWalletID: &f.to.ID, CategoryID: &f.expense.ID}, common.ErrCodeTransferCategoryImmutable},
		{"destination without a transfer", expense.ID, dto.UpdateTransactionRequest{ToWalletID: &f.to.ID}, common.ErrCodeInvalidInput},
		{"a transfer's destination moved", transfer.ID, dto.UpdateTransactionRequest{ToWalletID: &other.ID}, common.ErrCodeTransferWalletImmutable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := f.svc.UpdateTransaction(context.Background(), f.userID, tc.id, tc.req)
			assertAppErrCode(t, err, tc.code)
		})
	}
	// Nothing above may have moved a balance.
	f.wantBalances(t, 700000, 600000)
}

// Naming the type and destination it already has changes nothing.
func TestUpdateTransaction_Retype_SameTypeIsNoChange(t *testing.T) {
	f := newRetypeFixture(t)
	transfer := f.create(t, dto.CreateTransactionRequest{WalletID: f.from.ID, ToWalletID: &f.to.ID, Amount: 100000, Type: "transfer"})

	_, balance, err := f.svc.UpdateTransaction(context.Background(), f.userID, transfer.ID, dto.UpdateTransactionRequest{
		Type: ptr("transfer"), ToWalletID: &f.to.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance != nil {
		t.Fatalf("no balance moved, want nil, got %d", *balance)
	}
	f.wantBalances(t, 900000, 600000)
}
