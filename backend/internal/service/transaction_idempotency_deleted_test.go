package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// specs/mobile-offline-support US-08: the same idempotency key always resolves
// to the same original Transaction, even after it was soft-deleted.

func newKeyedExpenseRequest(walletID, categoryID uuid.UUID, key uuid.UUID) dto.CreateTransactionRequest {
	return dto.CreateTransactionRequest{
		WalletID:       walletID,
		CategoryID:     categoryID,
		Amount:         200000,
		Type:           string(model.TransactionTypeExpense),
		IdempotencyKey: &key,
	}
}

// S-OFF-60: a create replayed with the key of a deleted Transaction is a
// replay — no new row, no balance change, no audit entry, never undeleted.
func TestCreateTransaction_ReplayOfDeletedTransaction(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	req := newKeyedExpenseRequest(wallet.ID, category.ID, uuid.New())

	original, _, _, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}
	if _, err := svc.DeleteTransaction(context.Background(), userID, original.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	balanceAfterDelete := txRepo.balanceOf(wallet.ID)
	rowsAfterDelete := len(txRepo.transactions)

	replayed, balance, wasReplay, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("replay must not fail: %v", err)
	}
	if !wasReplay || balance != nil {
		t.Fatalf("expected replay with nil balance, got wasReplay=%v balance=%v", wasReplay, balance)
	}
	if replayed.ID != original.ID {
		t.Fatalf("expected the original Transaction %s, got %s", original.ID, replayed.ID)
	}
	if replayed.DeletedAt == nil {
		t.Fatal("the replayed Transaction must stay deleted")
	}
	if len(txRepo.transactions) != rowsAfterDelete {
		t.Fatal("a replay must not insert a row")
	}
	if txRepo.balanceOf(wallet.ID) != balanceAfterDelete {
		t.Fatal("a replay must not move the balance")
	}
	if entries := txRepo.auditLogsFor(original.ID); len(entries) != 2 {
		t.Fatalf("expected only the create + delete audit entries, got %d", len(entries))
	}
}

// S-OFF-61: a never-used key creates normally.
func TestCreateTransaction_FreshKeyCreates(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	_, balance, wasReplay, err := svc.CreateTransaction(context.Background(), userID, newKeyedExpenseRequest(wallet.ID, category.ID, uuid.New()))
	if err != nil || wasReplay || balance == nil {
		t.Fatalf("expected a fresh create, got err=%v wasReplay=%v balance=%v", err, wasReplay, balance)
	}
}

// S-OFF-62: keys are per User — another User's deleted Transaction with the
// same key does not make this User's create a replay.
func TestCreateTransaction_KeyOfAnotherUserIsFresh(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	key := uuid.New()
	otherID := uuid.New()
	otherWallet := seedTestWallet(t, walletRepo, txRepo, otherID, 1000000)
	otherCategory := seedTestCategory(categoryRepo, otherID, "Food", model.CategoryTypeExpense)
	otherTx, _, _, err := svc.CreateTransaction(context.Background(), otherID, newKeyedExpenseRequest(otherWallet.ID, otherCategory.ID, key))
	if err != nil {
		t.Fatalf("other user's create: %v", err)
	}
	if _, err := svc.DeleteTransaction(context.Background(), otherID, otherTx.ID); err != nil {
		t.Fatalf("other user's delete: %v", err)
	}

	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	created, _, wasReplay, err := svc.CreateTransaction(context.Background(), userID, newKeyedExpenseRequest(wallet.ID, category.ID, key))
	if err != nil || wasReplay {
		t.Fatalf("expected a fresh create for this user, got err=%v wasReplay=%v", err, wasReplay)
	}
	if created.ID == otherTx.ID {
		t.Fatal("must never resolve to another user's Transaction")
	}
}

// importAndDeleteAll commits a preview, then soft-deletes every resulting
// Transaction through the service, as the User would on another device.
func importAndDeleteAll(t *testing.T, svc *TransactionImportService, txRepo *fakeTransactionRepo, userID uuid.UUID, file []byte) {
	t.Helper()
	preview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if _, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: preview.ImportToken}); err != nil {
		t.Fatalf("commit: %v", err)
	}
	for id := range txRepo.transactions {
		if _, err := svc.transactionService.DeleteTransaction(context.Background(), userID, id); err != nil {
			t.Fatalf("delete: %v", err)
		}
	}
}

// S-OFF-63 + S-OFF-64 + S-OFF-65: a mixed file — one new row, one row whose
// import still exists, one imported-then-deleted row — each skipped row
// carries its own reason.
func TestPreviewImport_DistinguishesDeletedDuplicates(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	deletedRow := expenseRow(30000, "Food", "Cash", "deleted")
	activeRow := expenseRow(20000, "Food", "Cash", "active")
	newRow := expenseRow(10000, "Food", "Cash", "new")

	importAndDeleteAll(t, svc, txRepo, userID, buildTestWorkbook(t, [][]interface{}{deletedRow}))
	activePreview, err := svc.PreviewImport(context.Background(), userID, buildTestWorkbook(t, [][]interface{}{activeRow}))
	if err != nil {
		t.Fatalf("preview active: %v", err)
	}
	if _, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: activePreview.ImportToken}); err != nil {
		t.Fatalf("commit active: %v", err)
	}

	result, err := svc.PreviewImport(context.Background(), userID, buildTestWorkbook(t, [][]interface{}{newRow, activeRow, deletedRow}))
	if err != nil {
		t.Fatalf("preview mixed: %v", err)
	}
	if len(result.Valid) != 1 || len(result.Duplicates) != 2 || len(result.Errors) != 0 {
		t.Fatalf("expected 1 valid / 2 duplicates / 0 errors, got %+v", result)
	}
	reasons := map[int]string{}
	for _, d := range result.Duplicates {
		reasons[d.Row] = d.Reason
	}
	const activeRowNumber, deletedRowNumber = 3, 4
	if reasons[activeRowNumber] != importReasonAlreadyImported {
		t.Fatalf("active duplicate: expected %q, got %q", importReasonAlreadyImported, reasons[activeRowNumber])
	}
	if reasons[deletedRowNumber] != importReasonImportedThenDeleted {
		t.Fatalf("deleted duplicate: expected %q, got %q", importReasonImportedThenDeleted, reasons[deletedRowNumber])
	}
}

// S-OFF-66: a row previewed as importable that is imported and deleted before
// this confirm is counted as skipped, never failed, and writes nothing.
func TestCommitImport_DeletedDuplicateAfterPreviewIsSkipped(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	wallet := seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Food", "Cash", "race")})

	stalePreview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	importAndDeleteAll(t, svc, txRepo, userID, file)
	balanceBefore := txRepo.balanceOf(wallet.ID)
	rowsBefore := len(txRepo.transactions)

	result, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: stalePreview.ImportToken})
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if result.Imported != 0 || result.Skipped != 1 || result.Failed != 0 {
		t.Fatalf("expected 0 imported / 1 skipped / 0 failed, got %+v", result)
	}
	if txRepo.balanceOf(wallet.ID) != balanceBefore || len(txRepo.transactions) != rowsBefore {
		t.Fatal("a deleted-duplicate commit must write nothing")
	}
}
