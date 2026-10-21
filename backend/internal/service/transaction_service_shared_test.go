package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// specs/shared-wallets US-04: recording into, and reading, a shared wallet.

func expenseIn(walletID, categoryID uuid.UUID, amount int64) dto.CreateTransactionRequest {
	return dto.CreateTransactionRequest{WalletID: walletID, CategoryID: categoryID, Amount: amount, Type: "expense"}
}

// S-SHW-30 / S-SHW-32 / S-SHW-36: an editor's expense moves the shared
// balance; the wallet's own list shows it to the owner with who recorded it;
// the editor's personal list keeps only their own entries.
func TestSharedWallet_EditorRecordsAndOwnerSeesIt(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	ctx := context.Background()
	ownerID, editorID := uuid.New(), uuid.New()
	walletRepo.userNames[editorID] = "Bình"
	shared := seedTestWallet(t, walletRepo, txRepo, ownerID, 1_000_000)
	walletRepo.seedMember(shared.ID, editorID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	editorFood := seedTestCategory(categoryRepo, editorID, "Ăn uống", model.CategoryTypeExpense)
	ownerFood := seedTestCategory(categoryRepo, ownerID, "Chợ", model.CategoryTypeExpense)

	_, balance, _, err := svc.CreateTransaction(ctx, editorID, expenseIn(shared.ID, editorFood.ID, 200_000))
	if err != nil {
		t.Fatalf("editor create: %v", err)
	}
	if balance == nil || *balance != 800_000 {
		t.Fatalf("expected shared balance 800000, got %v", balance)
	}
	if _, _, _, err := svc.CreateTransaction(ctx, ownerID, expenseIn(shared.ID, ownerFood.ID, 100_000)); err != nil {
		t.Fatalf("owner create: %v", err)
	}

	result, err := svc.ListTransactions(ctx, ownerID, dto.ListTransactionsQuery{WalletID: shared.ID.String()})
	if err != nil {
		t.Fatalf("owner list: %v", err)
	}
	if len(result.Transactions) != 2 {
		t.Fatalf("owner should see both entries in the shared wallet, got %d", len(result.Transactions))
	}
	for _, tr := range result.Transactions {
		if tr.UserID == editorID && (tr.RecordedByName == nil || *tr.RecordedByName != "Bình") {
			t.Fatalf("editor's entry should carry the recorder's name, got %v", tr.RecordedByName)
		}
		if tr.UserID == ownerID && tr.RecordedByName != nil {
			t.Fatalf("the caller's own entry should not carry a recorder name")
		}
	}
	if result.Total == nil || *result.Total != 2 {
		t.Fatalf("expected total 2, got %v", result.Total)
	}

	personal, err := svc.ListTransactions(ctx, editorID, dto.ListTransactionsQuery{})
	if err != nil || len(personal.Transactions) != 1 || personal.Transactions[0].UserID != editorID {
		t.Fatalf("editor's own list should hold only the editor's entry, got %+v (%v)", personal.Transactions, err)
	}
}

// S-SHW-31 and the pending/outsider cases: no write, and no read for
// someone who is not an active member.
func TestSharedWallet_ViewerPendingAndOutsiderAreRefused(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	ctx := context.Background()
	ownerID, viewerID, pendingID, outsiderID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	shared := seedTestWallet(t, walletRepo, txRepo, ownerID, 1_000_000)
	walletRepo.seedMember(shared.ID, viewerID, model.WalletMemberRoleViewer, model.WalletMemberStatusActive)
	walletRepo.seedMember(shared.ID, pendingID, model.WalletMemberRoleEditor, model.WalletMemberStatusPending)

	for _, userID := range []uuid.UUID{viewerID, pendingID, outsiderID} {
		category := seedTestCategory(categoryRepo, userID, "Ăn uống", model.CategoryTypeExpense)
		_, _, _, err := svc.CreateTransaction(ctx, userID, expenseIn(shared.ID, category.ID, 10_000))
		assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
	}

	if _, err := svc.ListTransactions(ctx, viewerID, dto.ListTransactionsQuery{WalletID: shared.ID.String()}); err != nil {
		t.Fatalf("a viewer may read the wallet's list: %v", err)
	}
	for _, userID := range []uuid.UUID{pendingID, outsiderID} {
		_, err := svc.ListTransactions(ctx, userID, dto.ListTransactionsQuery{WalletID: shared.ID.String()})
		assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
	}
}

// S-SHW-33 / S-SHW-34: only the recorder edits an entry, and only while
// they can still record into the wallet.
func TestSharedWallet_EditRules(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	ctx := context.Background()
	ownerID, editorID := uuid.New(), uuid.New()
	shared := seedTestWallet(t, walletRepo, txRepo, ownerID, 1_000_000)
	walletRepo.seedMember(shared.ID, editorID, model.WalletMemberRoleEditor, model.WalletMemberStatusActive)
	category := seedTestCategory(categoryRepo, editorID, "Ăn uống", model.CategoryTypeExpense)

	entry, _, _, err := svc.CreateTransaction(ctx, editorID, expenseIn(shared.ID, category.ID, 50_000))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	note := "sửa"
	_, _, err = svc.UpdateTransaction(ctx, ownerID, entry.ID, dto.UpdateTransactionRequest{Note: &note})
	assertAppErrCode(t, err, common.ErrCodeTransactionAccessDenied)

	if _, err := walletRepo.RemoveWalletMember(ctx, shared.ID, editorID); err != nil {
		t.Fatalf("remove: %v", err)
	}
	_, err = svc.DeleteTransaction(ctx, editorID, entry.ID)
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
	_, _, err = svc.UpdateTransaction(ctx, editorID, entry.ID, dto.UpdateTransactionRequest{Note: &note})
	assertAppErrCode(t, err, common.ErrCodeWalletAccessDenied)
}
