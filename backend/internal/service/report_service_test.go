package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

func newTestReportService(t *testing.T) (*ReportService, *fakeReportRepo, *fakeWalletRepo, *fakeCategoryRepo) {
	t.Helper()
	reportRepo := newFakeReportRepo()
	walletRepo := newFakeWalletRepo()
	categoryRepo := newFakeCategoryRepo()
	return NewReportService(reportRepo, walletRepo, categoryRepo, newTestCycleResolver(), zap.NewNop()), reportRepo, walletRepo, categoryRepo
}

// S-RPT-01/S-RPT-04: happy path, no filters — the seeded per-currency totals
// and by_category breakdown pass through unchanged.
func TestReportService_GetSummary_Success(t *testing.T) {
	svc, reportRepo, _, _ := newTestReportService(t)
	userID := uuid.New()
	categoryID := uuid.New()
	reportRepo.seedTotals(
		model.ReportTypeAmount{Type: "income", Currency: "VND", Amount: 5000000},
		model.ReportTypeAmount{Type: "expense", Currency: "VND", Amount: 3200000},
		model.ReportTypeAmount{Type: "expense", Currency: "USD", Amount: 15000},
	)
	reportRepo.seedByCategory(
		model.ReportCategoryEntry{CategoryID: categoryID, CategoryName: "Rent", Type: "expense", Currency: "VND", Amount: 2000000},
	)

	resp, err := svc.GetSummary(context.Background(), userID, dto.ReportSummaryQuery{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Totals) != 2 {
		t.Fatalf("expected 2 currency totals, got %d", len(resp.Totals))
	}
	if resp.Totals[1].Currency != "USD" || resp.Totals[1].Net != -15000 {
		t.Fatalf("expected USD net -15000, got %+v", resp.Totals[1])
	}
	if len(resp.ByCategory) != 1 || resp.ByCategory[0].CategoryName != "Rent" {
		t.Fatalf("expected 1 by_category row for Rent, got %+v", resp.ByCategory)
	}
}

// S-RPT-02: zero matching Transactions is a valid empty report, not an error.
func TestReportService_GetSummary_Empty(t *testing.T) {
	svc, _, _, _ := newTestReportService(t)

	resp, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Totals) != 0 || len(resp.ByCategory) != 0 {
		t.Fatalf("expected an empty report, got %+v", resp)
	}
}

// Domain Concept table / plan.md Finding #6: with no from/to supplied, the
// window defaults to the caller's current cycle — with no plan, the calendar
// month containing "now" with its boundary at local (app timezone) midnight.
func TestReportService_GetSummary_DefaultWindowIsCurrentCycle(t *testing.T) {
	svc, reportRepo, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	now := time.Now().UTC()
	local := now.In(common.AppLocation)
	wantFrom := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, common.AppLocation)
	if !reportRepo.lastFilter.From.Equal(wantFrom) {
		t.Fatalf("expected default from %v, got %v", wantFrom, reportRepo.lastFilter.From)
	}
	if reportRepo.lastFilter.To.Before(now.Add(-time.Minute)) {
		t.Fatalf("expected default to to be close to now, got %v", reportRepo.lastFilter.To)
	}
}

// S-RPT-22: supplying only `from` defaults `to` independently to "now" — the
// two bounds never default as an all-or-nothing pair.
func TestReportService_GetSummary_PartialWindowDefaultsIndependently(t *testing.T) {
	svc, reportRepo, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{From: "2025-01-01"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	wantFrom := time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)
	if !reportRepo.lastFilter.From.Equal(wantFrom) {
		t.Fatalf("expected explicit from %v, got %v", wantFrom, reportRepo.lastFilter.From)
	}
	if reportRepo.lastFilter.To.Before(time.Now().UTC().Add(-time.Minute)) {
		t.Fatalf("expected to to default to now, got %v", reportRepo.lastFilter.To)
	}
}

// S-RPT-19: from after to is a validation error, not a query.
func TestReportService_GetSummary_FromAfterTo(t *testing.T) {
	svc, _, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{From: "2026-08-31", To: "2026-08-01"})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}

// S-RPT-20: a malformed from/to value is a validation error.
func TestReportService_GetSummary_MalformedFrom(t *testing.T) {
	svc, _, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{From: "not-a-date"})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}

// S-RPT-23: a wallet_id filter owned by the caller is threaded into the
// repository filter unchanged.
func TestReportService_GetSummary_WalletFilter_Owned(t *testing.T) {
	svc, reportRepo, walletRepo, _ := newTestReportService(t)
	userID := uuid.New()
	wallet, err := walletRepo.CreateWallet(context.Background(), nil, repository.CreateWalletParams{
		UserID: userID, Name: "Main Wallet", Type: "cash", Currency: "VND",
	})
	if err != nil {
		t.Fatalf("seed wallet: %v", err)
	}

	_, err = svc.GetSummary(context.Background(), userID, dto.ReportSummaryQuery{WalletID: wallet.ID.String()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if reportRepo.lastFilter.WalletID == nil || *reportRepo.lastFilter.WalletID != wallet.ID {
		t.Fatalf("expected wallet_id filter to be threaded through, got %+v", reportRepo.lastFilter)
	}
}

// S-RPT-24: a wallet_id filter owned by a different user is a 403.
func TestReportService_GetSummary_WalletFilter_AccessDenied(t *testing.T) {
	svc, _, walletRepo, _ := newTestReportService(t)
	owner := uuid.New()
	wallet, err := walletRepo.CreateWallet(context.Background(), nil, repository.CreateWalletParams{
		UserID: owner, Name: "Main Wallet", Type: "cash", Currency: "VND",
	})
	if err != nil {
		t.Fatalf("seed wallet: %v", err)
	}

	_, err = svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{WalletID: wallet.ID.String()})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWalletAccessDenied {
		t.Fatalf("expected WALLET_ACCESS_DENIED, got %v", err)
	}
}

// S-RPT-25: a wallet_id filter that doesn't exist at all is a 404.
func TestReportService_GetSummary_WalletFilter_NotFound(t *testing.T) {
	svc, _, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{WalletID: uuid.New().String()})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWalletNotFound {
		t.Fatalf("expected WALLET_NOT_FOUND, got %v", err)
	}
}

// S-RPT-26: a category_id filter for a private category owned by a different
// user is a 403.
func TestReportService_GetSummary_CategoryFilter_AccessDenied(t *testing.T) {
	svc, _, _, categoryRepo := newTestReportService(t)
	owner := uuid.New()
	category, err := categoryRepo.CreateCategory(context.Background(), repository.CreateCategoryParams{
		UserID: owner, Name: "Food", Type: "expense",
	})
	if err != nil {
		t.Fatalf("seed category: %v", err)
	}

	_, err = svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{CategoryID: category.ID.String()})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryAccessDenied {
		t.Fatalf("expected CATEGORY_ACCESS_DENIED, got %v", err)
	}
}

// S-RPT-27: a category_id filter that doesn't exist at all is a 404.
func TestReportService_GetSummary_CategoryFilter_NotFound(t *testing.T) {
	svc, _, _, _ := newTestReportService(t)

	_, err := svc.GetSummary(context.Background(), uuid.New(), dto.ReportSummaryQuery{CategoryID: uuid.New().String()})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCategoryNotFound {
		t.Fatalf("expected CATEGORY_NOT_FOUND, got %v", err)
	}
}
