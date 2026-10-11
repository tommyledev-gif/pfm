package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// writeItemsSheet adds the Items sheet (specs/transaction-line-items BR-15):
// one row per Item or Adjustment, in the same Transaction order as the main
// sheet. Always written, header only when nothing has lines (S-TXI-34).
func writeItemsSheet(file *excelize.File, transactions []*model.Transaction, linesByTransaction map[uuid.UUID]repository.TransactionLines) error {
	sheet := common.TransactionExportItemsSheetName
	if _, err := file.NewSheet(sheet); err != nil {
		return fmt.Errorf("service.writeItemsSheet: %w", err)
	}
	header := make([]interface{}, len(common.TransactionExportItemColumns))
	for i, name := range common.TransactionExportItemColumns {
		header[i] = name
	}
	if err := file.SetSheetRow(sheet, "A1", &header); err != nil {
		return fmt.Errorf("service.writeItemsSheet: %w", err)
	}

	rowNumber := 2 // 1-based, row 1 is the header
	for _, transaction := range transactions {
		lines, ok := linesByTransaction[transaction.ID]
		if !ok {
			continue
		}
		for _, row := range itemSheetRows(transaction, lines) {
			cell := fmt.Sprintf("A%d", rowNumber)
			if err := file.SetSheetRow(sheet, cell, &row); err != nil {
				return fmt.Errorf("service.writeItemsSheet: %w", err)
			}
			rowNumber++
		}
	}
	return nil
}

func itemSheetRows(transaction *model.Transaction, lines repository.TransactionLines) [][]interface{} {
	note := ""
	if transaction.Note != nil {
		note = *transaction.Note
	}
	parent := []interface{}{
		transaction.OccurredAt.UTC().Format(common.DateOnlyLayout),
		common.CentsToMajorUnits(transaction.Amount),
		note,
		transaction.CreatedAt.UTC().Format(common.TransactionExportCreatedAtLayout),
	}
	rows := make([][]interface{}, 0, len(lines.Items)+len(lines.Adjustments))
	for _, item := range lines.Items {
		var unitPrice interface{} = ""
		if item.UnitPrice != nil {
			unitPrice = common.CentsToMajorUnits(*item.UnitPrice)
		}
		rows = append(rows, withParent(parent,
			common.TransactionExportLineLabels[string(model.LineKindItem)],
			item.Name, item.Quantity, unitPrice, common.CentsToMajorUnits(item.Amount),
		))
	}
	for _, adjustment := range lines.Adjustments {
		label := ""
		if adjustment.Label != nil {
			label = *adjustment.Label
		}
		rows = append(rows, withParent(parent,
			common.TransactionExportLineLabels[string(adjustment.Kind)],
			label, "", "", common.CentsToMajorUnits(adjustment.SignedAmount()),
		))
	}
	return rows
}

func withParent(parent []interface{}, cells ...interface{}) []interface{} {
	row := make([]interface{}, 0, len(parent)+len(cells))
	row = append(row, parent...)
	return append(row, cells...)
}
