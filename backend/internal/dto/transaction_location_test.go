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

	var bad UpdateTransactionRequest
	if err := DecodeStrict([]byte(`{"location":{"latitude":1,"longitude":2}}`), &bad); err == nil {
		t.Fatal("coordinates are not editable — a PATCH carrying location must be rejected")
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
