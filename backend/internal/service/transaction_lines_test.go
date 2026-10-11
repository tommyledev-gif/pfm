package service

import (
	"errors"
	"testing"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

func ptr[T any](v T) *T { return &v }

func item(name string, amount int64) dto.TransactionItemRequest {
	return dto.TransactionItemRequest{Name: name, Amount: amount}
}

func adjustment(kind string, amount int64) dto.TransactionAdjustmentRequest {
	return dto.TransactionAdjustmentRequest{Kind: kind, Amount: amount}
}

func TestNormalizeLines_DefaultsAndKindSigns(t *testing.T) {
	lines, err := normalizeLines(
		[]dto.TransactionItemRequest{{Name: "  Sữa  ", Amount: 3000000}},
		[]dto.TransactionAdjustmentRequest{
			adjustment("tax", 800000),
			adjustment("discount", 200000),
			{Kind: "other", Direction: ptr("subtract"), Label: ptr("Làm tròn"), Amount: 100},
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if lines.Items[0].Name != "Sữa" || lines.Items[0].Quantity != defaultItemQuantity {
		t.Fatalf("expected trimmed name and default quantity, got %+v", lines.Items[0])
	}
	wantSigns := []model.LineSign{model.LineSignAdd, model.LineSignSubtract, model.LineSignSubtract}
	for i, want := range wantSigns {
		if lines.Adjustments[i].Sign != want {
			t.Fatalf("adjustment %d: expected sign %d, got %d", i, want, lines.Adjustments[i].Sign)
		}
	}
}

// S-TXI-06, S-TXI-08, S-TXI-11: every Kind-dependent problem is reported in one 400.
func TestNormalizeLines_CollectsEveryProblem(t *testing.T) {
	_, err := normalizeLines(
		[]dto.TransactionItemRequest{{Name: "   ", Amount: 100}},
		[]dto.TransactionAdjustmentRequest{
			{Kind: "other", Amount: 100},
			{Kind: "discount", Direction: ptr("add"), Amount: 100},
		},
	)
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
	problems, ok := appErr.Details.([]lineFieldError)
	if !ok || len(problems) != 4 {
		t.Fatalf("expected 4 problems (blank name, other direction, other label, discount direction), got %+v", appErr.Details)
	}
}

// S-TXI-08: Adjustments without any Item.
func TestNormalizeLines_AdjustmentsRequireItems(t *testing.T) {
	_, err := normalizeLines(nil, []dto.TransactionAdjustmentRequest{adjustment("tax", 100)})
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
}

func TestReconcile(t *testing.T) {
	lines, err := normalizeLines(
		[]dto.TransactionItemRequest{item("Sữa", 3000000), item("Bánh mì", 7000000)},
		[]dto.TransactionAdjustmentRequest{adjustment("tax", 800000)},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cases := []struct {
		name    string
		amount  int64
		wantErr bool
	}{
		{"exact match", 10800000, false},
		{"gap without explanation (S-TXI-04)", 10000000, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := reconcile(tc.amount, lines)
			if tc.wantErr {
				assertAppErrCode(t, err, common.ErrCodeItemsTotalMismatch)
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// EC-04: a discount larger than the Items makes the computed total ≤ 0, which
// never matches an amount (always > 0).
func TestReconcile_DiscountAboveItemsNeverMatches(t *testing.T) {
	lines, _ := normalizeLines(
		[]dto.TransactionItemRequest{item("Sữa", 100)},
		[]dto.TransactionAdjustmentRequest{adjustment("discount", 200)},
	)
	assertAppErrCode(t, reconcile(1, lines), common.ErrCodeItemsTotalMismatch)
}

func TestReconcile_NoItemsPasses(t *testing.T) {
	lines, _ := normalizeLines(nil, nil)
	if err := reconcile(5000, lines); err != nil {
		t.Fatalf("plain Transaction must pass, got %v", err)
	}
}
