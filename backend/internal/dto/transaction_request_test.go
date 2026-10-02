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
