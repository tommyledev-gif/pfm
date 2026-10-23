package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

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
