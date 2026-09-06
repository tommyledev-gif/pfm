package service

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// specs/transaction-audit-log/spec.md US-01 — every successful Create/Update/
// Delete writes exactly one entry; every rejected one writes none.

func decodeAuditSide(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	if raw == nil {
		return nil
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("audit side is not valid JSON: %v", err)
	}
	return out
}

// S-TAL-01: create writes action=create, before=NULL, after=full snapshot.
func TestAuditLog_CreateWritesOneEntry(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     200000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries := txRepo.auditLogsFor(transaction.ID)
	if len(entries) != 1 {
		t.Fatalf("expected exactly 1 audit entry, got %d", len(entries))
	}
	entry := entries[0]
	if entry.Action != model.AuditActionCreate {
		t.Fatalf("expected action=create, got %q", entry.Action)
	}
	if entry.UserID != userID {
		t.Fatalf("audit entry recorded the wrong user")
	}
	if entry.Before != nil {
		t.Fatalf("create must have no before-state, got %s", entry.Before)
	}
	after := decodeAuditSide(t, entry.After)
	if after["amount"] != float64(200000) {
		t.Fatalf("expected after.amount=200000 (integer cents), got %v", after["amount"])
	}
	if after["type"] != "expense" {
		t.Fatalf("expected after.type=expense, got %v", after["type"])
	}
}

// S-TAL-05: a rejected create (insufficient balance) writes no entry at all.
func TestAuditLog_RejectedCreateWritesNothing(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 100000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     200000,
		Type:       "expense",
	})
	assertAppErrCode(t, err, common.ErrCodeInsufficientBalance)

	if len(txRepo.auditLogs) != 0 {
		t.Fatalf("a rejected mutation must write no audit entry, got %d", len(txRepo.auditLogs))
	}
}

// S-TAL-02/S-TAL-03: update records only the fields the PATCH supplied.
func TestAuditLog_UpdateRecordsOnlyChangedFields(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     200000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	newAmount := int64(300000)
	if _, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Amount: &newAmount,
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries := txRepo.auditLogsFor(transaction.ID)
	if len(entries) != 2 {
		t.Fatalf("expected create + update entries, got %d", len(entries))
	}
	update := entries[1]
	if update.Action != model.AuditActionUpdate {
		t.Fatalf("expected action=update, got %q", update.Action)
	}

	before := decodeAuditSide(t, update.Before)
	after := decodeAuditSide(t, update.After)
	if before["amount"] != float64(200000) || after["amount"] != float64(300000) {
		t.Fatalf("expected amount 200000 -> 300000, got %v -> %v", before["amount"], after["amount"])
	}
	// Only `amount` was in the PATCH body, so nothing else may appear —
	// fabricating an unchanged field into the diff would make the log lie
	// about what the user actually did.
	if len(before) != 1 || len(after) != 1 {
		t.Fatalf("update entry must contain only the changed field, got before=%v after=%v", before, after)
	}
}

// S-TAL-04: delete records action=delete with a full before-snapshot.
func TestAuditLog_DeleteRecordsSnapshot(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     200000,
		Type:       "expense",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := svc.DeleteTransaction(context.Background(), userID, transaction.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries := txRepo.auditLogsFor(transaction.ID)
	if len(entries) != 2 {
		t.Fatalf("expected create + delete entries, got %d", len(entries))
	}
	deleted := entries[1]
	if deleted.Action != model.AuditActionDelete {
		t.Fatalf("expected action=delete, got %q", deleted.Action)
	}
	if deleted.After != nil {
		t.Fatalf("delete must have no after-state, got %s", deleted.After)
	}
	before := decodeAuditSide(t, deleted.Before)
	if before["amount"] != float64(200000) {
		t.Fatalf("expected before.amount=200000, got %v", before["amount"])
	}
}

// Constitution note (plan.md, Idempotency row): an idempotent replay creates
// nothing, so it must also log nothing — otherwise the history would show a
// second "create" for a Transaction that was only ever written once.
func TestAuditLog_IdempotentReplayWritesNoSecondEntry(t *testing.T) {
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

	transaction, _, wasReplay, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil || wasReplay {
		t.Fatalf("first create should be fresh: err=%v wasReplay=%v", err, wasReplay)
	}

	if _, _, wasReplay, err = svc.CreateTransaction(context.Background(), userID, req); err != nil || !wasReplay {
		t.Fatalf("second create should be a replay: err=%v wasReplay=%v", err, wasReplay)
	}

	if entries := txRepo.auditLogsFor(transaction.ID); len(entries) != 1 {
		t.Fatalf("a replay must not write a second audit entry, got %d", len(entries))
	}
}
