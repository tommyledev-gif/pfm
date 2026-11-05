package dto

import (
	"strconv"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
)

// The amount tag is a literal (a tag cannot reference a constant), so this
// pins it to common.MaxTransactionAmountCents — and through it to the mobile
// keypad's limit — at exactly max and max+1.
func TestCreateTransactionRequest_AmountCeiling(t *testing.T) {
	v := validator.New()
	base := CreateTransactionRequest{WalletID: uuid.New(), CategoryID: uuid.New(), Type: "expense"}

	atMax := base
	atMax.Amount = common.MaxTransactionAmountCents
	if err := v.Struct(atMax); err != nil {
		t.Fatalf("amount at the ceiling must pass, got %v", err)
	}

	overMax := base
	overMax.Amount = common.MaxTransactionAmountCents + 1
	err := v.Struct(overMax)
	if err == nil || !strings.Contains(err.Error(), "Amount") {
		t.Fatalf("amount past the ceiling must fail on Amount, got %v", err)
	}
}

func TestUpdateTransactionRequest_AmountCeiling(t *testing.T) {
	v := validator.New()
	over := common.MaxTransactionAmountCents + 1
	if err := v.Struct(UpdateTransactionRequest{Amount: &over}); err == nil {
		t.Fatalf("update past the ceiling (%s) must fail", strconv.FormatInt(over, 10))
	}
	atMax := common.MaxTransactionAmountCents
	if err := v.Struct(UpdateTransactionRequest{Amount: &atMax}); err != nil {
		t.Fatalf("update at the ceiling must pass, got %v", err)
	}
}

// PATCH accepts wallet_id since 2026-10-13 (moving a Transaction to another
// Wallet). Unknown fields are still rejected by DecodeStrict.
func TestUpdateTransactionRequest_WalletID(t *testing.T) {
	walletID := uuid.New()
	var req UpdateTransactionRequest
	if err := DecodeStrict([]byte(`{"wallet_id":"`+walletID.String()+`"}`), &req); err != nil {
		t.Fatalf("wallet_id must be accepted by DecodeStrict, got %v", err)
	}
	if req.WalletID == nil || *req.WalletID != walletID {
		t.Fatalf("expected wallet_id %s, got %v", walletID, req.WalletID)
	}
	if !req.HasUpdates() {
		t.Fatal("a wallet_id-only PATCH must count as an update")
	}

	var unknown UpdateTransactionRequest
	if err := DecodeStrict([]byte(`{"user_id":"`+walletID.String()+`"}`), &unknown); err == nil {
		t.Fatal("an unknown field must still be rejected by DecodeStrict")
	}
}

// PATCH accepts type and to_wallet_id since 2026-11-05 (changing what a
// Transaction is); the service checks how they combine.
func TestUpdateTransactionRequest_Type(t *testing.T) {
	v := validator.New()
	toWalletID := uuid.New()
	var req UpdateTransactionRequest
	body := `{"type":"transfer","to_wallet_id":"` + toWalletID.String() + `"}`
	if err := DecodeStrict([]byte(body), &req); err != nil {
		t.Fatalf("type and to_wallet_id must be accepted by DecodeStrict, got %v", err)
	}
	if req.Type == nil || *req.Type != "transfer" || req.ToWalletID == nil || *req.ToWalletID != toWalletID {
		t.Fatalf("expected type transfer to %s, got %v → %v", toWalletID, req.Type, req.ToWalletID)
	}
	if !req.HasUpdates() {
		t.Fatal("a type-only PATCH must count as an update")
	}
	if err := v.Struct(req); err != nil {
		t.Fatalf("a valid type must pass, got %v", err)
	}

	bad := "refund"
	if err := v.Struct(UpdateTransactionRequest{Type: &bad}); err == nil || !strings.Contains(err.Error(), "Type") {
		t.Fatalf("an unknown type must fail on Type, got %v", err)
	}
}
