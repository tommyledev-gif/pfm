package dto

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// Shape validation for a Transaction's optional map pin
// (026_transactions_location.sql) — range and length checks live on the DTO.

func float64Ptr(v float64) *float64 { return &v }

func locationRequestBase() CreateTransactionRequest {
	return CreateTransactionRequest{WalletID: uuid.New(), CategoryID: uuid.New(), Amount: 1000, Type: "expense"}
}

func TestCreateTransactionRequest_LocationIsOptional(t *testing.T) {
	if err := validator.New().Struct(locationRequestBase()); err != nil {
		t.Fatalf("a request without location must pass, got %v", err)
	}
}

func TestCreateTransactionRequest_LocationRanges(t *testing.T) {
	cases := []struct {
		name      string
		lat, lng  *float64
		wantField string // "" = must pass
	}{
		{"equator and prime meridian (zero is a real coordinate)", float64Ptr(0), float64Ptr(0), ""},
		{"Ho Chi Minh City", float64Ptr(10.7769), float64Ptr(106.7009), ""},
		{"exact bounds", float64Ptr(-90), float64Ptr(180), ""},
		{"exact opposite bounds", float64Ptr(90), float64Ptr(-180), ""},
		{"latitude above 90", float64Ptr(90.0001), float64Ptr(0), "Latitude"},
		{"latitude below -90", float64Ptr(-91), float64Ptr(0), "Latitude"},
		{"longitude above 180", float64Ptr(0), float64Ptr(180.5), "Longitude"},
		{"longitude below -180", float64Ptr(0), float64Ptr(-181), "Longitude"},
		{"latitude missing", nil, float64Ptr(106.7), "Latitude"},
		{"longitude missing", float64Ptr(10.7), nil, "Longitude"},
	}
	v := validator.New()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := locationRequestBase()
			req.Location = &TransactionLocationRequest{Latitude: tc.lat, Longitude: tc.lng}
			err := v.Struct(req)
			if tc.wantField == "" {
				if err != nil {
					t.Fatalf("expected pass, got %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantField) {
				t.Fatalf("expected a failure on %s, got %v", tc.wantField, err)
			}
		})
	}
}

// max counts characters, not bytes — a Vietnamese place name is mostly
// multi-byte runes and must not be cut short at a third of its length.
func TestCreateTransactionRequest_LocationTextLimits(t *testing.T) {
	v := validator.New()
	withText := func(placeName, note string) CreateTransactionRequest {
		req := locationRequestBase()
		req.Location = &TransactionLocationRequest{
			Latitude: float64Ptr(10.7769), Longitude: float64Ptr(106.7009),
			PlaceName: &placeName, Note: &note,
		}
		return req
	}

	if err := v.Struct(withText(strings.Repeat("ồ", 200), strings.Repeat("ữ", 500))); err != nil {
		t.Fatalf("200-char place_name and 500-char note must pass, got %v", err)
	}
	if err := v.Struct(withText(strings.Repeat("a", 201), "")); err == nil || !strings.Contains(err.Error(), "PlaceName") {
		t.Fatalf("201-char place_name must fail on PlaceName, got %v", err)
	}
	if err := v.Struct(withText("", strings.Repeat("a", 501))); err == nil || !strings.Contains(err.Error(), "Note") {
		t.Fatalf("501-char note must fail on Note, got %v", err)
	}
}

// PATCH is decoded with DecodeStrict, so location_note must be a declared
// field; "" (clear) is still an update for HasUpdates.
func TestUpdateTransactionRequest_LocationNote(t *testing.T) {
	var req UpdateTransactionRequest
	if err := DecodeStrict([]byte(`{"location_note":""}`), &req); err != nil {
		t.Fatalf("location_note must be accepted by DecodeStrict, got %v", err)
	}
	if req.LocationNote == nil || *req.LocationNote != "" {
		t.Fatalf("expected location_note decoded as \"\", got %v", req.LocationNote)
	}
	if !req.HasUpdates() {
		t.Fatal("a location_note-only PATCH (even \"\") must count as an update")
	}

	tooLong := strings.Repeat("a", 501)
	if err := validator.New().Struct(UpdateTransactionRequest{LocationNote: &tooLong}); err == nil {
		t.Fatal("501-char location_note must fail validation")
	}
}

// PATCH may move an existing pin (2026-10-07): `location` carries the new
// coordinates and place name, never a note.
func TestUpdateTransactionRequest_LocationMove(t *testing.T) {
	var req UpdateTransactionRequest
	body := `{"location":{"latitude":10.7769,"longitude":106.7009,"place_name":"Quận 1"}}`
	if err := DecodeStrict([]byte(body), &req); err != nil {
		t.Fatalf("a PATCH carrying location must be accepted by DecodeStrict, got %v", err)
	}
	if req.Location == nil || req.Location.Latitude == nil || *req.Location.Latitude != 10.7769 ||
		req.Location.Longitude == nil || *req.Location.Longitude != 106.7009 ||
		req.Location.PlaceName == nil || *req.Location.PlaceName != "Quận 1" {
		t.Fatalf("location decoded wrong: %+v", req.Location)
	}
	if err := validator.New().Struct(req); err != nil {
		t.Fatalf("a valid move must pass validation, got %v", err)
	}
	if !req.HasUpdates() {
		t.Fatal("a location-only PATCH must count as an update")
	}

	var noName UpdateTransactionRequest
	if err := DecodeStrict([]byte(`{"location":{"latitude":0,"longitude":0,"place_name":null}}`), &noName); err != nil {
		t.Fatalf("place_name is optional and nullable, got %v", err)
	}
	if err := validator.New().Struct(noName); err != nil {
		t.Fatalf("0,0 without a place name must pass, got %v", err)
	}
}

// The note keeps its own field (location_note). DecodeStrict's
// DisallowUnknownFields reaches nested objects, so `location.note` is a 400.
func TestUpdateTransactionRequest_LocationMoveRejectsNote(t *testing.T) {
	var req UpdateTransactionRequest
	err := DecodeStrict([]byte(`{"location":{"latitude":1,"longitude":2,"note":"cổng xanh"}}`), &req)
	if err == nil || !strings.Contains(err.Error(), `unknown field "note"`) {
		t.Fatalf("a note inside location must be rejected as an unknown field, got %v", err)
	}
}

func TestUpdateTransactionRequest_LocationMoveValidation(t *testing.T) {
	longName := strings.Repeat("ồ", 201)
	cases := []struct {
		name      string
		move      TransactionLocationMoveRequest
		wantField string // "" = must pass
	}{
		{"exact bounds", TransactionLocationMoveRequest{Latitude: float64Ptr(-90), Longitude: float64Ptr(180)}, ""},
		{"latitude above 90", TransactionLocationMoveRequest{Latitude: float64Ptr(90.5), Longitude: float64Ptr(0)}, "Latitude"},
		{"longitude below -180", TransactionLocationMoveRequest{Latitude: float64Ptr(0), Longitude: float64Ptr(-180.1)}, "Longitude"},
		{"latitude missing", TransactionLocationMoveRequest{Longitude: float64Ptr(106.7)}, "Latitude"},
		{"longitude missing", TransactionLocationMoveRequest{Latitude: float64Ptr(10.7)}, "Longitude"},
		{"place_name over 200 chars", TransactionLocationMoveRequest{Latitude: float64Ptr(1), Longitude: float64Ptr(2), PlaceName: &longName}, "PlaceName"},
	}
	v := validator.New()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			move := tc.move
			err := v.Struct(UpdateTransactionRequest{Location: &move})
			if tc.wantField == "" {
				if err != nil {
					t.Fatalf("expected pass, got %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantField) {
				t.Fatalf("expected a failure on %s, got %v", tc.wantField, err)
			}
		})
	}
}

func TestTransactionResponse_LocationJSON(t *testing.T) {
	base := &model.Transaction{ID: uuid.New(), Type: model.TransactionTypeExpense, OccurredAt: time.Now()}

	raw, err := json.Marshal(NewTransactionResponse(base))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(raw), `"location":null`) {
		t.Fatalf("location must be present as null when absent, got %s", raw)
	}

	note := "Hẻm 12, cổng xanh"
	withLocation := *base
	withLocation.Location = &model.TransactionLocation{Latitude: 10.7769, Longitude: 106.7009, Note: &note}
	raw, err = json.Marshal(NewTransactionResponse(&withLocation))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	want := `"location":{"latitude":10.7769,"longitude":106.7009,"place_name":null,"note":"Hẻm 12, cổng xanh"}`
	if !strings.Contains(string(raw), want) {
		t.Fatalf("expected %s in %s", want, raw)
	}
}
