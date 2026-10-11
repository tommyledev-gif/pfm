package handler

import (
	"testing"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

// Line fields are validated through a *[]T on PATCH and a []T on POST, and
// every failing line field is reported with its path
// (specs/transaction-line-items S-TXI-06, S-TXI-07, S-TXI-10).
func TestValidate_LineFieldsReportPaths(t *testing.T) {
	zero := int32(0)
	items := []dto.TransactionItemRequest{
		{Name: "Sữa", Amount: 100},
		{Name: "", Quantity: &zero, Amount: 0},
	}
	err := validate.Struct(dto.UpdateTransactionRequest{Items: &items})
	if err == nil {
		t.Fatal("expected validation errors")
	}
	appErr := newValidationError(err)
	details, ok := appErr.Details.([]fieldError)
	if !ok || len(details) != 3 {
		t.Fatalf("expected 3 field errors (name, quantity, amount), got %+v", appErr.Details)
	}
	for _, d := range details {
		if d.Path == "" {
			t.Fatalf("expected a path on every line error, got %+v", d)
		}
	}
	if appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %s", appErr.Code)
	}
}

func TestValidate_TooManyItems(t *testing.T) {
	items := make([]dto.TransactionItemRequest, common.TransactionItemsMax+1)
	for i := range items {
		items[i] = dto.TransactionItemRequest{Name: "x", Amount: 1}
	}
	if err := validate.Struct(dto.CreateTransactionRequest{Items: items}); err == nil {
		t.Fatal("expected the item maximum to be enforced")
	}
}

func TestValidate_TopLevelFieldHasNoPath(t *testing.T) {
	err := validate.Struct(dto.CreateTransactionRequest{})
	appErr := newValidationError(err)
	for _, d := range appErr.Details.([]fieldError) {
		if d.Path != "" {
			t.Fatalf("top-level field must not carry a path, got %+v", d)
		}
	}
}
