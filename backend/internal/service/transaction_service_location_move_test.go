package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

// Moving an existing pin via PATCH `location` (2026-10-07): new coordinates
// and a new place name; the note is untouched; a pin-less Transaction cannot
// gain one.

func moveReq(lat, lng float64, placeName *string) *dto.TransactionLocationMoveRequest {
	return &dto.TransactionLocationMoveRequest{Latitude: &lat, Longitude: &lng, PlaceName: placeName}
}

func TestTransactionService_MoveLocation_UpdatesPinKeepsNote(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
		locationReq(10.7769, 106.7009, strPtr("Quận 1"), strPtr("Hẻm 12")))

	updated, balance, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Location: moveReq(21.0285, 105.8542, strPtr("  Hoàn Kiếm, Hà Nội ")),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance != nil {
		t.Fatalf("a move must not report a wallet balance change, got %d", *balance)
	}
	loc := updated.Location
	if loc == nil || loc.Latitude != 21.0285 || loc.Longitude != 105.8542 {
		t.Fatalf("expected the pin moved to 21.0285,105.8542, got %+v", loc)
	}
	if loc.PlaceName == nil || *loc.PlaceName != "Hoàn Kiếm, Hà Nội" {
		t.Fatalf("expected the new place name trimmed, got %v", loc.PlaceName)
	}
	if loc.Note == nil || *loc.Note != "Hẻm 12" {
		t.Fatalf("a move must leave the note untouched, got %v", loc.Note)
	}

	fetched, err := svc.GetTransaction(context.Background(), userID, transaction.ID)
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}
	if fetched.Location == nil || fetched.Location.Latitude != 21.0285 {
		t.Fatalf("expected the move persisted, got %+v", fetched.Location)
	}

	// create + move; the move is logged as before/after `location` objects,
	// and nothing else.
	entries := txRepo.auditLogsFor(transaction.ID)
	if len(entries) != 2 {
		t.Fatalf("expected 2 audit entries, got %d", len(entries))
	}
	before := decodeAuditSide(t, entries[1].Before)
	after := decodeAuditSide(t, entries[1].After)
	if len(before) != 1 || len(after) != 1 {
		t.Fatalf("a location-only PATCH must log only location, got before=%v after=%v", before, after)
	}
	assertAuditPin(t, before["location"], 10.7769, 106.7009, "Quận 1")
	assertAuditPin(t, after["location"], 21.0285, 105.8542, "Hoàn Kiếm, Hà Nội")
}

func TestTransactionService_MoveLocation_RejectedWithoutLocation(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID, nil)

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Location: moveReq(10.7769, 106.7009, strPtr("Quận 1")),
	})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)

	fetched, err := svc.GetTransaction(context.Background(), userID, transaction.ID)
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}
	if fetched.Location != nil {
		t.Fatalf("a rejected move must not add a pin, got %+v", fetched.Location)
	}
	if entries := txRepo.auditLogsFor(transaction.ID); len(entries) != 1 {
		t.Fatalf("a rejected update must write no audit entry, got %d entries", len(entries))
	}
}

// The old place name described the old position, so a move never keeps it:
// absent, empty and whitespace-only place_name all store NULL.
func TestTransactionService_MoveLocation_PlaceNameNormalized(t *testing.T) {
	cases := []struct {
		name      string
		placeName *string
	}{
		{"absent", nil},
		{"empty", strPtr("")},
		{"whitespace only", strPtr("   ")},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
			userID := uuid.New()
			transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
				locationReq(10.7769, 106.7009, strPtr("Quận 1"), nil))

			updated, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
				Location: moveReq(10.78, 106.70, tc.placeName),
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if updated.Location == nil || updated.Location.PlaceName != nil {
				t.Fatalf("expected place name NULL after the move, got %+v", updated.Location)
			}

			after := decodeAuditSide(t, txRepo.auditLogsFor(transaction.ID)[1].After)
			pin, _ := after["location"].(map[string]any)
			if v, ok := pin["place_name"]; !ok || v != nil {
				t.Fatalf("expected after.location.place_name=null, got %v (present=%v)", v, ok)
			}
		})
	}
}

// location and location_note are independent fields; one PATCH may carry both.
func TestTransactionService_MoveLocation_WithNoteInSamePatch(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
		locationReq(10.7769, 106.7009, nil, strPtr("Hẻm 12")))

	updated, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Location:     moveReq(10.8, 106.8, strPtr("Quận 3")),
		LocationNote: strPtr(""),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	loc := updated.Location
	if loc == nil || loc.Latitude != 10.8 || loc.PlaceName == nil || *loc.PlaceName != "Quận 3" || loc.Note != nil {
		t.Fatalf("expected the pin moved and the note cleared, got %+v", loc)
	}

	after := decodeAuditSide(t, txRepo.auditLogsFor(transaction.ID)[1].After)
	if _, ok := after["location"]; !ok {
		t.Fatalf("expected after.location in the audit entry, got %v", after)
	}
	if v, ok := after["location_note"]; !ok || v != nil {
		t.Fatalf("expected after.location_note=null, got %v (present=%v)", v, ok)
	}
}

// The DTO's `required` normally catches this; the service must still refuse
// rather than dereference a nil coordinate.
func TestTransactionService_MoveLocation_MissingCoordinate(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	userID := uuid.New()
	transaction := createExpenseWithLocation(t, svc, txRepo, walletRepo, categoryRepo, userID,
		locationReq(10.7769, 106.7009, nil, nil))
	lat := 10.0

	_, _, err := svc.UpdateTransaction(context.Background(), userID, transaction.ID, dto.UpdateTransactionRequest{
		Location: &dto.TransactionLocationMoveRequest{Latitude: &lat},
	})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
}

func assertAuditPin(t *testing.T, side any, lat, lng float64, placeName string) {
	t.Helper()
	pin, ok := side.(map[string]any)
	if !ok {
		t.Fatalf("expected an audit location object, got %v", side)
	}
	if pin["latitude"] != lat || pin["longitude"] != lng || pin["place_name"] != placeName {
		t.Fatalf("expected location %v,%v %q, got %v", lat, lng, placeName, pin)
	}
	if _, hasNote := pin["note"]; hasNote {
		t.Fatalf("a move's audit location must not carry the note, got %v", pin)
	}
}
