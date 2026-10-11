package service

import (
	"bytes"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

func exportedItemRows(t *testing.T, data []byte) [][]string {
	t.Helper()
	file, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("open workbook: %v", err)
	}
	defer file.Close() //nolint:errcheck // test reader
	if sheets := file.GetSheetList(); sheets[0] != common.TransactionExportSheetName {
		t.Fatalf("expected the Transactions sheet first (import reads it), got %v", sheets)
	}
	rows, err := file.GetRows(common.TransactionExportItemsSheetName)
	if err != nil {
		t.Fatalf("read items sheet: %v", err)
	}
	return rows
}

// S-TXI-33: lines on the second sheet, signed amounts, linked to the parent.
func TestWriteWorkbook_ItemsSheet(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	parent := &model.Transaction{ID: uuid.New(), Amount: 10000000, Type: model.TransactionTypeExpense, OccurredAt: now, CreatedAt: now}
	label := "Giảm giá thành viên"
	lines := repository.TransactionLines{
		Items: []model.TransactionItem{{Name: "Sữa", Quantity: 2, UnitPrice: ptr(int64(1500000)), Amount: 3000000}, {Name: "Thịt 0.5kg", Quantity: 1, Amount: 9000000}},
		Adjustments: []model.TransactionAdjustment{
			{Kind: model.LineKindDiscount, Sign: model.LineSignSubtract, Label: &label, Amount: 2000000},
		},
	}

	data, err := writeWorkbook([]*model.Transaction{parent}, map[uuid.UUID]string{}, map[uuid.UUID]repository.TransactionLines{parent.ID: lines})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rows := exportedItemRows(t, data)
	if len(rows) != 4 {
		t.Fatalf("expected header + 3 line rows, got %d: %v", len(rows), rows)
	}
	discount := rows[3]
	if discount[4] != "Discount" || discount[8] != "-20000" {
		t.Fatalf("expected a negative Discount row, got %v", discount)
	}
	if rows[1][0] != "2026-10-02" || rows[1][1] != "100000" {
		t.Fatalf("expected parent date and amount on each line row, got %v", rows[1])
	}
}

// S-TXI-34: nothing has lines — header only.
func TestWriteWorkbook_ItemsSheetHeaderOnly(t *testing.T) {
	data, err := writeWorkbook(nil, map[uuid.UUID]string{}, map[uuid.UUID]repository.TransactionLines{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rows := exportedItemRows(t, data); len(rows) != 1 {
		t.Fatalf("expected header only, got %v", rows)
	}
}
