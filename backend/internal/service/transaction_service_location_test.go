package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Transaction location (026_transactions_location.sql): an optional map pin
// set on create. Afterwards its note is editable (this file) and the pin can
// be moved, or added to a Transaction without one
// (transaction_service_location_move_test.go).

func locationReq(lat, lng float64, placeName, note *string) *dto.TransactionLocationRequest {
	return &dto.TransactionLocationRequest{Latitude: &lat, Longitude: &lng, PlaceName: placeName, Note: note}
}

// createExpenseWithLocation creates a 100000-cent expense, with a location
// when loc is non-nil.
func createExpenseWithLocation(t *testing.T, svc *TransactionService, txRepo *fakeTransactionRepo, walletRepo *fakeWalletRepo, categoryRepo *fakeCategoryRepo, userID uuid.UUID, loc *dto.TransactionLocationRequest) *model.Transaction {
	t.Helper()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   wallet.ID,
		CategoryID: category.ID,
		Amount:     100000,
		Type:       "expense",
		Location:   loc,
	})
	if err != nil {
		t.Fatalf("unexpected create error: %v", err)
	}
	return transaction
}

func TestTransactionService_CreateTransaction_PassesLocationThrough(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()

	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
		locationReq(10.7769, 106.7009, strPtr("  Quận 1, TP. Hồ Chí Minh "), strPtr("   ")))

	loc := transaction.Location
	if loc == nil {
		t.Fatal("expected the created transaction to carry its location")
	}
	if loc.Latitude != 10.7769 || loc.Longitude != 106.7009 {
		t.Fatalf("expected coordinates 10.7769,106.7009, got %v,%v", loc.Latitude, loc.Longitude)
	}
	if loc.PlaceName == nil || *loc.PlaceName != "Quận 1, TP. Hồ Chí Minh" {
		t.Fatalf("expected trimmed place name, got %v", loc.PlaceName)
	}
	if loc.Note != nil {
		t.Fatalf("a whitespace-only note must be stored as NULL, got %q", *loc.Note)
	}

	// Read back through GetTransaction, not just the create response.
	fetched, err := svc.GetTransaction(context.Background(), userID, transaction.ID)
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}
	if fetched.Location == nil || fetched.Location.Latitude != 10.7769 {
		t.Fatalf("expected location persisted, got %+v", fetched.Location)
	}
}

func TestTransactionService_CreateTransaction_WithoutLocation(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, uuid.New(), nil)
	if transaction.Location != nil {
		t.Fatalf("expected no location, got %+v", transaction.Location)
	}
}

// Any type may carry a location — transfers included.
func TestTransactionService_CreateTransfer_PassesLocationThrough(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	seedTransferCategory(categoryRepo)
	source := seedTransferWallet(t, walletRepo, txRepo, userID, "Tiền mặt", "VND", 500000)
	destination := seedTransferWallet(t, walletRepo, txRepo, userID, "Techcombank", "VND", 0)

	transaction, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID:   source.ID,
		ToWalletID: &destination.ID,
		Amount:     200000,
		Type:       "transfer",
		Location:   locationReq(0, 0, nil, strPtr("ATM")),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if transaction.Location == nil || transaction.Location.Note == nil || *transaction.Location.Note != "ATM" {
		t.Fatalf("expected the transfer to keep its location, got %+v", transaction.Location)
	}
}

func TestTransactionService_CreateTransaction_IdempotentReplayReturnsLocation(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	key := uuid.New()
	req := dto.CreateTransactionRequest{
		WalletID: wallet.ID, CategoryID: category.ID, Amount: 100000, Type: "expense",
		IdempotencyKey: &key,
		Location:       locationReq(21.0285, 105.8542, strPtr("Hoàn Kiếm, Hà Nội"), nil),
	}

	if _, _, _, err := svc.CreateTransaction(context.Background(), userID, req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	replayed, _, wasReplay, err := svc.CreateTransaction(context.Background(), userID, req)
	if err != nil || !wasReplay {
		t.Fatalf("expected a replay, got err=%v wasReplay=%v", err, wasReplay)
	}
	if replayed.Location == nil || replayed.Location.PlaceName == nil || *replayed.Location.PlaceName != "Hoàn Kiếm, Hà Nội" {
		t.Fatalf("expected the replay to return the location, got %+v", replayed.Location)
	}
}

// The DTO's `required` normally catches this; the service must still refuse
// rather than dereference a nil coordinate.
func TestTransactionService_CreateTransaction_LocationMissingCoordinate(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	wallet := seedTestWallet(t, walletRepo, txRepo, userID, 1000000)
	category := seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	lat := 10.0

	_, _, _, err := svc.CreateTransaction(context.Background(), userID, dto.CreateTransactionRequest{
		WalletID: wallet.ID, CategoryID: category.ID, Amount: 100000, Type: "expense",
		Location: &dto.TransactionLocationRequest{Latitude: &lat},
	})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
	if got := txRepo.balanceOf(wallet.ID); got != 1000000 {
		t.Fatalf("a rejected create must not touch the balance, got %d", got)
	}
}

func TestTransactionService_UpdateLocationNote_RejectedWithoutLocation(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID, nil)

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		LocationNote: strPtr("cổng xanh"),
	})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
	if entries := txRepo.auditLogsFor(transaction.ID); len(entries) != 1 {
		t.Fatalf("a rejected update must write no audit entry, got %d entries", len(entries))
	}
}

func TestTransactionService_UpdateLocationNote_SetsAndClears(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
		locationReq(10.7769, 106.7009, strPtr("Quận 1"), strPtr("Hẻm 12")))

	updated, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		LocationNote: strPtr("Hẻm 12, cổng xanh"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Location == nil || updated.Location.Note == nil || *updated.Location.Note != "Hẻm 12, cổng xanh" {
		t.Fatalf("expected the note set, got %+v", updated.Location)
	}

	cleared, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		LocationNote: strPtr(""),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	loc := cleared.Location
	if loc == nil {
		t.Fatal("clearing the note must keep the location itself")
	}
	if loc.Note != nil {
		t.Fatalf("\"\" must clear the note to NULL, got %q", *loc.Note)
	}
	if loc.Latitude != 10.7769 || loc.Longitude != 106.7009 || loc.PlaceName == nil || *loc.PlaceName != "Quận 1" {
		t.Fatalf("coordinates and place name must be untouched, got %+v", loc)
	}

	// create + set + clear; the clear is logged as before=old note, after=null.
	entries := txRepo.auditLogsFor(transaction.ID)
	if len(entries) != 3 {
		t.Fatalf("expected 3 audit entries, got %d", len(entries))
	}
	before := decodeAuditSide(t, entries[2].Before)
	after := decodeAuditSide(t, entries[2].After)
	if before["location_note"] != "Hẻm 12, cổng xanh" {
		t.Fatalf("expected before.location_note to be the old note, got %v", before["location_note"])
	}
	if v, ok := after["location_note"]; !ok || v != nil {
		t.Fatalf("expected after.location_note=null, got %v (present=%v)", v, ok)
	}
	if len(before) != 1 || len(after) != 1 {
		t.Fatalf("a location_note-only PATCH must log only location_note, got before=%v after=%v", before, after)
	}
}
