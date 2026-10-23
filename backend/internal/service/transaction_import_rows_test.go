package service

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"

	"github.com/example/pfm/backend/internal/common"
)

// workbookWithRows writes a header plus the given data rows starting at
// worksheet row 2; a nil entry leaves that row empty.
func workbookWithRows(t *testing.T, rows [][]interface{}) []byte {
	t.Helper()
	header := make([]interface{}, len(common.TransactionExportColumns))
	for i, name := range common.TransactionExportColumns {
		header[i] = name
	}
	file := excelize.NewFile()
	defer file.Close() //nolint:errcheck // in-memory
	if err := file.SetSheetRow("Sheet1", "A1", &header); err != nil {
		t.Fatalf("write header: %v", err)
	}
	for i, row := range rows {
		if row == nil {
			continue
		}
		r := row
		if err := file.SetSheetRow("Sheet1", fmt.Sprintf("A%d", i+2), &r); err != nil {
			t.Fatalf("write row: %v", err)
		}
	}
	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		t.Fatalf("encode: %v", err)
	}
	return buf.Bytes()
}

func expenseRows(n int) [][]interface{} {
	rows := make([][]interface{}, n)
	for i := range rows {
		rows[i] = expenseRow(1000, "Ăn uống", "Ví", "")
	}
	return rows
}

func assertInvalidInput(t *testing.T, err error, wantMessage string) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("want INVALID_INPUT, got %v", err)
	}
	if wantMessage != "" && appErr.Message != wantMessage {
		t.Fatalf("message = %q, want %q", appErr.Message, wantMessage)
	}
}

// S-HRD-04: a workbook whose parts decompress beyond the cap is refused as an
// unreadable workbook, before any row is read.
func TestReadWorksheetRows_DecompressedSizeOverCapIsRefused(t *testing.T) {
	big := make([][]interface{}, 200)
	for i := range big {
		big[i] = expenseRow(1000, strings.Repeat("x", 500), "Ví", strings.Repeat("y", 500))
	}
	file := workbookWithRows(t, big)

	limits := defaultImportReadLimits
	limits.unzipSize = 4 * 1024 // far below what 200 KB of cell text unzips to
	limits.unzipXMLSize = limits.unzipSize
	_, _, err := readWorksheetRows(file, limits)
	assertInvalidInput(t, err, "tệp không phải là tệp .xlsx hợp lệ")

	if _, rows, err := readWorksheetRows(file, defaultImportReadLimits); err != nil || len(rows) != len(big) {
		t.Fatalf("the same file under the real cap: rows=%d err=%v", len(rows), err)
	}
}

// S-HRD-05/S-HRD-06: the row cap is inclusive and its message names the cap.
func TestReadWorksheetRows_RowCap(t *testing.T) {
	limits := defaultImportReadLimits
	limits.maxDataRows = 3

	if _, rows, err := readWorksheetRows(workbookWithRows(t, expenseRows(3)), limits); err != nil || len(rows) != 3 {
		t.Fatalf("at the cap: rows=%d err=%v", len(rows), err)
	}
	_, _, err := readWorksheetRows(workbookWithRows(t, expenseRows(4)), limits)
	assertInvalidInput(t, err, "Tệp có quá 3 dòng. Tách thành nhiều tệp nhỏ hơn.")
}

func TestReadWorksheetRows_RealCapMessageIsFormatted(t *testing.T) {
	_, _, err := readWorksheetRows(workbookWithRows(t, expenseRows(common.TransactionImportMaxDataRows+1)), defaultImportReadLimits)
	assertInvalidInput(t, err, "Tệp có quá 10.000 dòng. Tách thành nhiều tệp nhỏ hơn.")
}

// S-HRD-07: blank rows, inside or after the data, never count toward the cap,
// and every data row keeps the worksheet row number the user sees.
func TestReadWorksheetRows_BlankRowsAreSkippedAndNumbersKept(t *testing.T) {
	limits := defaultImportReadLimits
	limits.maxDataRows = 2
	rows := [][]interface{}{expenseRow(1, "A", "Ví", ""), nil, {"", "  "}, expenseRow(2, "B", "Ví", ""), nil}

	header, data, err := readWorksheetRows(workbookWithRows(t, rows), limits)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if header[0] != common.TransactionExportColumns[0] {
		t.Fatalf("header = %v", header)
	}
	if len(data) != 2 || data[0].number != 2 || data[1].number != 5 {
		t.Fatalf("rows = %+v, want numbers 2 and 5", data)
	}
}

func TestReadWorksheetRows_EmptySheetHasNoHeader(t *testing.T) {
	file := excelize.NewFile()
	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		t.Fatalf("encode: %v", err)
	}
	_, _, err := readWorksheetRows(buf.Bytes(), defaultImportReadLimits)
	assertInvalidInput(t, err, "tệp không có dòng tiêu đề")
}
