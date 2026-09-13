package service

import (
	"bytes"
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

const testSigningKey = "test-signing-key-for-import-tokens"

func newTestImportService(t *testing.T) (*TransactionImportService, *fakeTransactionRepo, *fakeWalletRepo, *fakeCategoryRepo) {
	t.Helper()
	transactionService, txRepo, walletRepo, categoryRepo := newTestTransactionService(t)
	tokens := NewTokenService(testSigningKey)
	svc := NewTransactionImportService(transactionService, txRepo, walletRepo, categoryRepo, tokens, zap.NewNop())
	return svc, txRepo, walletRepo, categoryRepo
}

// buildTestWorkbook renders rows into an in-memory .xlsx with the exact
// header the export writes, so the tests exercise the real round-trip shape
// rather than a hand-rolled column set.
func buildTestWorkbook(t *testing.T, rows [][]interface{}) []byte {
	t.Helper()
	file := excelize.NewFile()
	defer file.Close() //nolint:errcheck // in-memory

	sheet := common.TransactionExportSheetName
	index, err := file.NewSheet(sheet)
	if err != nil {
		t.Fatalf("new sheet: %v", err)
	}
	file.SetActiveSheet(index)
	if err := file.DeleteSheet("Sheet1"); err != nil {
		t.Fatalf("delete default sheet: %v", err)
	}

	header := make([]interface{}, len(common.TransactionExportColumns))
	for i, name := range common.TransactionExportColumns {
		header[i] = name
	}
	if err := file.SetSheetRow(sheet, "A1", &header); err != nil {
		t.Fatalf("write header: %v", err)
	}
	for i, row := range rows {
		r := row
		if err := file.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r); err != nil {
			t.Fatalf("write row: %v", err)
		}
	}

	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		t.Fatalf("encode workbook: %v", err)
	}
	return buf.Bytes()
}

// expenseRow is the canonical valid row shape: Date, Type, Amount, Currency,
// Category, Wallet, Note, Created At.
func expenseRow(amountMajor float64, category, wallet, note string) []interface{} {
	return []interface{}{"2026-09-01", "Expense", amountMajor, "VND", category, wallet, note, ""}
}

func seedNamedWallet(walletRepo *fakeWalletRepo, txRepo *fakeTransactionRepo, ownerID uuid.UUID, name string, balance int64) *model.Wallet {
	w := &model.Wallet{ID: uuid.New(), UserID: ownerID, Name: name, Type: model.WalletTypeCash, Balance: balance, Currency: "VND"}
	walletRepo.wallets[w.ID] = w
	txRepo.seedWallet(w)
	return w
}

// S-TXI-09: a well-formed file resolves every row, and the Amount column's
// major units become stored cents exactly once.
func TestPreviewImport_ResolvesValidRows(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Tiền mặt", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Ăn uống", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Ăn uống", "Tiền mặt", "Lunch")})
	result, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Valid) != 1 || len(result.Errors) != 0 || len(result.Duplicates) != 0 {
		t.Fatalf("expected 1 valid / 0 errors / 0 duplicates, got %+v", result)
	}
	// ⚠️ 80000 major units must land as 8_000_000 cents — the Context #1
	// conversion, asserted explicitly because getting it wrong is silent.
	if result.Valid[0].Amount != 8_000_000 {
		t.Fatalf("expected 8000000 cents, got %d", result.Valid[0].Amount)
	}
	if result.ImportToken == "" {
		t.Fatal("expected an import token")
	}
}

// S-TXI-11: two wallets sharing a name is an error for that row, never a
// silent "pick the first one".
func TestPreviewImport_AmbiguousWalletNameIsAnError(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Savings", 100_000_000)
	seedNamedWallet(walletRepo, txRepo, userID, "Savings", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Food", "Savings", "")})
	result, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Valid) != 0 || len(result.Errors) != 1 {
		t.Fatalf("expected the row to be rejected, got %+v", result)
	}
}

// S-TXI-12: an unmatched category is rejected, never auto-created.
func TestPreviewImport_UnknownCategoryIsRejectedNotCreated(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	before := len(categoryRepo.categories)

	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Groceries", "Cash", "")})
	result, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Errors) != 1 {
		t.Fatalf("expected 1 error row, got %+v", result.Errors)
	}
	if len(categoryRepo.categories) != before {
		t.Fatalf("import must never create a category: %d -> %d", before, len(categoryRepo.categories))
	}
}

// Edge Cases US-02 #1: one bad row never blocks the good ones.
func TestPreviewImport_BadRowDoesNotBlockOthers(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{
		expenseRow(80000, "Food", "Cash", "ok"),
		{"13/45/2026", "Expense", 50000, "VND", "Food", "Cash", "bad date", ""},
		{"2026-09-02", "Expense", -50000, "VND", "Food", "Cash", "negative", ""},
		expenseRow(20000, "Food", "Cash", "ok too"),
	})
	result, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Valid) != 2 || len(result.Errors) != 2 {
		t.Fatalf("expected 2 valid / 2 errors, got %d / %d", len(result.Valid), len(result.Errors))
	}
	if result.Errors[0].Row != 3 || result.Errors[1].Row != 4 {
		t.Fatalf("errors must name the worksheet row number, got %+v", result.Errors)
	}
}

// S-TXI-15: the derived key is content-addressed, so previewing the same file
// twice produces byte-identical keys. This is what makes a re-import a
// no-op instead of a duplicate.
func TestPreviewImport_IdempotencyKeyIsStableAcrossCalls(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Food", "Cash", "Lunch")})

	first, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	second, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if first.Valid[0].IdempotencyKey != second.Valid[0].IdempotencyKey {
		t.Fatalf("keys drifted between previews: %s vs %s", first.Valid[0].IdempotencyKey, second.Valid[0].IdempotencyKey)
	}
}

// Edge Cases US-02 #3: content, not extension, decides whether a file parses.
func TestPreviewImport_NonXlsxIsRejected(t *testing.T) {
	svc, _, _, _ := newTestImportService(t)
	_, err := svc.PreviewImport(context.Background(), uuid.New(), []byte("Date,Type,Amount\n2026-09-01,Expense,80000\n"))
	assertAppErrCode(t, err, common.ErrCodeInvalidInput)
}

// S-TXI-19: commit writes through CreateTransaction — the wallet balance
// moves exactly as it would for an equivalent POST /transactions.
func TestCommitImport_WritesRowsAndMovesBalance(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	wallet := seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{
		expenseRow(80000, "Food", "Cash", "a"),
		expenseRow(20000, "Food", "Cash", "b"),
	})
	preview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}

	result, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: preview.ImportToken})
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if result.Imported != 2 || result.Skipped != 0 || result.Failed != 0 {
		t.Fatalf("expected 2/0/0, got %+v", result)
	}
	if got := txRepo.wallets[wallet.ID].Balance; got != 100_000_000-10_000_000 {
		t.Fatalf("expected balance 90000000, got %d", got)
	}
}

// S-TXI-22: double-committing the same token is a no-op, not a duplicate.
func TestCommitImport_SecondCommitIsANoOp(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	wallet := seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Food", "Cash", "a")})
	preview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	req := dto.ImportCommitRequest{ImportToken: preview.ImportToken}
	if _, err := svc.CommitImport(context.Background(), userID, req); err != nil {
		t.Fatalf("first commit: %v", err)
	}
	balanceAfterFirst := txRepo.wallets[wallet.ID].Balance

	second, err := svc.CommitImport(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("second commit: %v", err)
	}
	if second.Imported != 0 || second.Skipped != 1 || second.Failed != 0 {
		t.Fatalf("expected 0 imported / 1 skipped, got %+v", second)
	}
	if txRepo.wallets[wallet.ID].Balance != balanceAfterFirst {
		t.Fatalf("a replayed commit must not move the balance again")
	}
}

// Finding #10 / S-TXI-23: a fresh row that fails for a non-replay reason lands
// in `failed`, never silently in `skipped`.
func TestCommitImport_BalanceRaceLandsInFailedNotSkipped(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	wallet := seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{
		expenseRow(80000, "Food", "Cash", "fits"),
		expenseRow(900000, "Food", "Cash", "too big after the race"),
	})
	preview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	// Drain the wallet between preview and commit, exactly like a separate
	// transaction created in the meantime.
	txRepo.wallets[wallet.ID].Balance = 10_000_000
	walletRepo.wallets[wallet.ID].Balance = 10_000_000

	result, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: preview.ImportToken})
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if result.Imported != 1 || result.Failed != 1 || result.Skipped != 0 {
		t.Fatalf("expected 1 imported / 1 failed / 0 skipped, got %+v", result)
	}
	if len(result.Failures) != 1 || result.Failures[0].Row != 3 {
		t.Fatalf("failure must name the worksheet row, got %+v", result.Failures)
	}
}

// S-TXI-21: a token minted for another user is rejected outright.
func TestCommitImport_TokenForAnotherUserIsForbidden(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	owner := uuid.New()
	seedNamedWallet(walletRepo, txRepo, owner, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, owner, "Food", model.CategoryTypeExpense)

	file := buildTestWorkbook(t, [][]interface{}{expenseRow(80000, "Food", "Cash", "")})
	preview, err := svc.PreviewImport(context.Background(), owner, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	_, err = svc.CommitImport(context.Background(), uuid.New(), dto.ImportCommitRequest{ImportToken: preview.ImportToken})
	assertAppErrCode(t, err, common.ErrCodeForbidden)
}

// Context #6: an access token must never be accepted where an import token is
// expected, even though both are signed with the same key.
func TestCommitImport_AccessTokenIsNotAnImportToken(t *testing.T) {
	svc, _, _, _ := newTestImportService(t)
	tokens := NewTokenService(testSigningKey)
	user := &model.User{ID: uuid.New(), Role: model.UserRoleMember}
	access, _, err := tokens.GenerateTokenPair(user)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	_, err = svc.CommitImport(context.Background(), user.ID, dto.ImportCommitRequest{ImportToken: access})
	assertAppErrCode(t, err, common.ErrCodeUnauthenticated)
}

// Context #1: the export/import money conversions must be exact inverses,
// including the separator forms a real spreadsheet emits.
func TestMoneyUnitRoundTrip(t *testing.T) {
	for _, cents := range []int64{1, 100, 8_000_000, 123_456_789, 999_999_999_900} {
		major := common.CentsToMajorUnits(cents)
		back, err := common.MajorUnitsToCents(fmt.Sprintf("%.2f", major))
		if err != nil {
			t.Fatalf("parse %v: %v", major, err)
		}
		if back != cents {
			t.Fatalf("round trip drifted: %d -> %v -> %d", cents, major, back)
		}
	}

	for raw, want := range map[string]int64{
		"80000":     8_000_000,
		"80,000":    8_000_000,
		"1.234.567": 123_456_700,
		"1,234.56":  123_456,
		"1.234,56":  123_456,
		"80.5":      8_050,
		"80 000 ₫":  8_000_000,
	} {
		got, err := common.MajorUnitsToCents(raw)
		if err != nil {
			t.Fatalf("parse %q: %v", raw, err)
		}
		if got != want {
			t.Fatalf("parse %q: expected %d cents, got %d", raw, want, got)
		}
	}
}
