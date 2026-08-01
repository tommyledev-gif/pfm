package dto

import (
	"encoding/json"
	"strings"
	"testing"
)

// An empty result set must serialize as "data":[], never "data":null — same
// convention as ListUsersResponse.
func TestListWalletsResponse_EmptyDataIsEmptyArrayNotNull(t *testing.T) {
	resp := ListWalletsResponse{Data: []WalletResponse{}}
	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	if strings.Contains(string(raw), `"data":null`) {
		t.Fatalf("expected \"data\":[], got: %s", raw)
	}
	if !strings.Contains(string(raw), `"data":[]`) {
		t.Fatalf("expected \"data\":[] in body, got: %s", raw)
	}
}

// S-WAL-20: an unrecognized "balance" field in a PATCH body must be
// rejected, not silently ignored (plan.md Finding #4).
func TestDecodeStrict_RejectsUnrecognizedBalanceField(t *testing.T) {
	body := []byte(`{"name": "Savings", "balance": 999999999}`)

	var req UpdateWalletRequest
	err := DecodeStrict(body, &req)
	if err == nil {
		t.Fatalf("expected an error for an unrecognized 'balance' field, got nil")
	}
}

// A legitimate PATCH body with only known fields must still decode cleanly.
func TestDecodeStrict_AcceptsKnownFields(t *testing.T) {
	body := []byte(`{"name": "Savings"}`)

	var req UpdateWalletRequest
	if err := DecodeStrict(body, &req); err != nil {
		t.Fatalf("unexpected error decoding a valid body: %v", err)
	}
	if req.Name == nil || *req.Name != "Savings" {
		t.Fatalf("expected name to be decoded as 'Savings', got %+v", req.Name)
	}
	if !req.HasUpdates() {
		t.Fatalf("expected HasUpdates to be true when name is set")
	}
}

// S-WAL-24: an empty body has nothing to update.
func TestUpdateWalletRequest_HasUpdates_EmptyBody(t *testing.T) {
	var req UpdateWalletRequest
	if req.HasUpdates() {
		t.Fatalf("expected HasUpdates to be false for an empty request")
	}
}
