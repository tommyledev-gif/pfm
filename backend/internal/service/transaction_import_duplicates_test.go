package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// specs/security-hardening-2026-10 F-16: two identical rows of one file are
// two purchases. Both are imported, and importing the same file again is
// still a no-op.
func TestImport_IdenticalRowsAreTwoTransactions(t *testing.T) {
	svc, txRepo, walletRepo, categoryRepo := newTestImportService(t)
	userID := uuid.New()
	wallet := seedNamedWallet(walletRepo, txRepo, userID, "Cash", 100_000_000)
	seedTestCategory(categoryRepo, userID, "Food", model.CategoryTypeExpense)
	coffee := expenseRow(35000, "Food", "Cash", "cà phê")
	file := buildTestWorkbook(t, [][]interface{}{coffee, coffee, expenseRow(20000, "Food", "Cash", "bánh")})

	preview, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if len(preview.Valid) != 3 || preview.Valid[0].IdempotencyKey == preview.Valid[1].IdempotencyKey {
		t.Fatalf("identical rows need their own keys: %+v", preview.Valid)
	}
	result, err := svc.CommitImport(context.Background(), userID, dto.ImportCommitRequest{ImportToken: preview.ImportToken})
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if result.Imported != 3 || result.Skipped != 0 {
		t.Fatalf("want 3 imported, got %+v", result)
	}
	if got := txRepo.wallets[wallet.ID].Balance; got != 100_000_000-9_000_000 {
		t.Fatalf("balance = %d, want both coffees and the cake taken", got)
	}

	again, err := svc.PreviewImport(context.Background(), userID, file)
	if err != nil {
		t.Fatalf("second preview: %v", err)
	}
	if len(again.Valid) != 0 || len(again.Duplicates) != 3 {
		t.Fatalf("re-importing the same file must find all 3 rows imported: %+v", again)
	}
}

// The first copy of a row keeps the plain content key, so a file imported
// before identical rows got their own keys still matches its earlier import.
func TestOccurrenceKey_FirstCopyKeepsTheContentKey(t *testing.T) {
	content := uuid.New()
	if occurrenceKey(content, 0) != content {
		t.Fatal("first copy must keep the content key")
	}
	second, third := occurrenceKey(content, 1), occurrenceKey(content, 2)
	if second == content || second == third || occurrenceKey(content, 1) != second {
		t.Fatal("repeats must get distinct, deterministic keys")
	}
}
