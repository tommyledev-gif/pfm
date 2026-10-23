package service

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"

	"github.com/example/pfm/backend/internal/common"
)

// importReadLimits bounds what reading one uploaded workbook may cost. A
// parameter rather than the constants inline so tests can prove the limits
// with tiny values instead of building a 64 MiB zip bomb.
type importReadLimits struct {
	unzipSize    int64
	unzipXMLSize int64
	maxDataRows  int
}

var defaultImportReadLimits = importReadLimits{
	unzipSize:    common.TransactionImportUnzipSizeLimit,
	unzipXMLSize: common.TransactionImportUnzipXMLSizeLimit,
	maxDataRows:  common.TransactionImportMaxDataRows,
}

// worksheetRow is one non-blank data row and the 1-based worksheet row number
// the user sees in Excel (spec.md S-TXI-14).
type worksheetRow struct {
	number int
	cells  []string
}

// readWorksheetRows opens the uploaded bytes as a workbook and returns the
// first sheet's header and its non-blank data rows.
//
// excelize's own parse failure IS the content validation (spec.md Edge Cases
// US-02 #3): a renamed .csv or any other non-OOXML payload fails to open as a
// zip+XML package here, before a single row is looked at. A workbook whose
// parts decompress past limits.unzipSize fails the same way
// (specs/security-hardening-2026-10 US-02).
//
// Rows are streamed, not loaded with GetRows: reading stops at the first data
// row over the cap, so memory is bounded by the cap rather than by the file.
func readWorksheetRows(file []byte, limits importReadLimits) ([]string, []worksheetRow, error) {
	workbook, err := excelize.OpenReader(bytes.NewReader(file), excelize.Options{
		UnzipSizeLimit:    limits.unzipSize,
		UnzipXMLSizeLimit: limits.unzipXMLSize,
	})
	if err != nil {
		return nil, nil, common.NewInvalidInputError("tệp không phải là tệp .xlsx hợp lệ")
	}
	defer workbook.Close() //nolint:errcheck // read-only; also removes any spilled temp file

	sheets := workbook.GetSheetList()
	if len(sheets) == 0 {
		return nil, nil, common.NewInvalidInputError("tệp không có trang tính nào")
	}
	rows, err := workbook.Rows(sheets[0])
	if err != nil {
		return nil, nil, common.NewInvalidInputError("không đọc được trang tính đầu tiên")
	}
	defer rows.Close() //nolint:errcheck // read-only iterator

	var header []string
	var data []worksheetRow
	// Rows yields every row index in order, gaps included, so the counter is
	// the worksheet row number (the same arithmetic excelize's GetRows does).
	for number := 1; rows.Next(); number++ {
		cells, err := rows.Columns()
		if err != nil {
			return nil, nil, common.NewInvalidInputError("không đọc được trang tính đầu tiên")
		}
		if header == nil {
			if isBlankRow(cells) {
				continue
			}
			header = cells
			continue
		}
		if isBlankRow(cells) {
			continue
		}
		if len(data) == limits.maxDataRows {
			return nil, nil, common.NewInvalidInputError(fmt.Sprintf("Tệp có quá %s dòng. Tách thành nhiều tệp nhỏ hơn.", common.FormatCountVI(int64(limits.maxDataRows))))
		}
		data = append(data, worksheetRow{number: number, cells: cells})
	}
	if err := rows.Error(); err != nil {
		return nil, nil, common.NewInvalidInputError("không đọc được trang tính đầu tiên")
	}
	if header == nil {
		return nil, nil, common.NewInvalidInputError("tệp không có dòng tiêu đề")
	}
	return header, data, nil
}

// isBlankRow skips the trailing empty rows spreadsheets routinely carry —
// reporting them as validation errors would bury the real ones.
func isBlankRow(raw []string) bool {
	for _, cell := range raw {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}
