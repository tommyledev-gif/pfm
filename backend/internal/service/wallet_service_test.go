package service

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

func newTestWalletService(t *testing.T) (*WalletService, *fakeWalletRepo) {
	t.Helper()
	repo := newFakeWalletRepo()
	return NewWalletService(repo, zap.NewNop()), repo
}

// S-WAL-01: a user's very first wallet is always forced to be the default,
// even when is_default isn't requested.
func TestWalletService_CreateWallet_FirstWalletForcedDefault(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{
		Name: "Main Wallet",
		Type: "cash",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !wallet.IsDefault {
		t.Fatalf("expected first wallet to be forced default")
	}
	if wallet.Currency != common.WalletDefaultCurrency {
		t.Fatalf("expected default currency %s, got %s", common.WalletDefaultCurrency, wallet.Currency)
	}
}

// S-WAL-02/S-WAL-03: a second wallet only becomes default when requested,
// and doing so atomically clears the previous default.
func TestWalletService_CreateWallet_SecondWalletDefaultSwap(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	first, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash"})
	if err != nil {
		t.Fatalf("unexpected error creating first wallet: %v", err)
	}

	t.Run("second wallet without is_default leaves first default untouched", func(t *testing.T) {
		second, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Bank", Type: "bank"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if second.IsDefault {
			t.Fatalf("expected second wallet not to be default")
		}
		refreshedFirst, err := svc.GetWallet(context.Background(), userID, first.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !refreshedFirst.IsDefault {
			t.Fatalf("expected first wallet to remain default")
		}
	})

	t.Run("third wallet requesting is_default swaps the default atomically", func(t *testing.T) {
		third, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "E-Wallet", Type: "e_wallet", IsDefault: true})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !third.IsDefault {
			t.Fatalf("expected third wallet to become default")
		}
		refreshedFirst, err := svc.GetWallet(context.Background(), userID, first.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if refreshedFirst.IsDefault {
			t.Fatalf("expected first wallet to no longer be default")
		}
	})
}

// S-WAL-10: two concurrent requests both creating a user's first wallet —
// exactly one ends up default, the other is still created successfully.
//
// Each create's own response reflects is_default at the instant it was
// written, which can go stale immediately afterward if a concurrent request
// then clears it and takes over as default (identical to what a real
// `INSERT ... RETURNING *` would report under the same interleaving) — so
// this asserts the settled state via a fresh read after both finish, not
// each goroutine's own possibly-stale creation-time snapshot.
func TestWalletService_CreateWallet_ConcurrentFirstWalletRace(t *testing.T) {
	svc, repo := newTestWalletService(t)
	userID := uuid.New()

	var wg sync.WaitGroup
	errs := make([]error, 2)
	start := make(chan struct{})
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			_, errs[idx] = svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Race Wallet", Type: "cash"})
		}(i)
	}
	close(start)
	wg.Wait()

	for idx, err := range errs {
		if err != nil {
			t.Fatalf("expected both concurrent creates to succeed, goroutine %d failed: %v", idx, err)
		}
	}

	settled, err := svc.ListWallets(context.Background(), userID, false)
	if err != nil {
		t.Fatalf("unexpected error listing wallets: %v", err)
	}
	defaultCount := 0
	for _, w := range settled {
		if w.IsDefault {
			defaultCount++
		}
	}
	if defaultCount != 1 {
		t.Fatalf("expected exactly 1 wallet to end up default in the settled state, got %d", defaultCount)
	}

	count, err := repo.CountWalletsByUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 wallets to exist, got %d", count)
	}
}

// S-WAL-16 vs S-WAL-17: ownership vs. existence must return distinct codes.
func TestWalletService_GetWallet_OwnershipVsExistence(t *testing.T) {
	svc, _ := newTestWalletService(t)
	ownerID := uuid.New()
	otherID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), ownerID, dto.CreateWalletRequest{Name: "Cash", Type: "cash"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("wallet owned by someone else returns 403 WALLET_ACCESS_DENIED", func(t *testing.T) {
		_, err := svc.GetWallet(context.Background(), otherID, wallet.ID)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWalletAccessDenied {
			t.Fatalf("expected WALLET_ACCESS_DENIED, got %v", err)
		}
	})

	t.Run("wallet that does not exist returns 404 WALLET_NOT_FOUND", func(t *testing.T) {
		_, err := svc.GetWallet(context.Background(), ownerID, uuid.New())
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWalletNotFound {
			t.Fatalf("expected WALLET_NOT_FOUND, got %v", err)
		}
	})
}

// S-WAL-24: an empty PATCH body is a client mistake, not a no-op success.
func TestWalletService_UpdateWallet_EmptyBodyRejected(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %v", err)
	}
}

// S-WAL-21: a currency change is rejected once the wallet has ≥1 Transaction
// (specs/transaction-management/plan.md Finding #2 / WAL-T14 — closes the
// deferral this test used to be blocked on).
func TestWalletService_UpdateWallet_CurrencyLockedOnceTransactionExists(t *testing.T) {
	svc, repo := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash", Currency: "VND"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	repo.seedTransactionForWallet(wallet.ID)

	newCurrency := "USD"
	_, err = svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{Currency: &newCurrency})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeCurrencyLocked {
		t.Fatalf("expected CURRENCY_LOCKED, got %v", err)
	}
}

// A wallet with zero Transactions can still freely change currency — the
// lock only activates once real financial history exists against it.
func TestWalletService_UpdateWallet_CurrencyChangeAllowedWithoutTransactions(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash", Currency: "VND"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	newCurrency := "USD"
	updated, err := svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{Currency: &newCurrency})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Currency != "USD" {
		t.Fatalf("expected currency updated to USD, got %s", updated.Currency)
	}
}

// Submitting the same currency the wallet already has is not treated as a
// "change" and never triggers the lock check, even with Transactions present.
func TestWalletService_UpdateWallet_SameCurrencyNeverLocked(t *testing.T) {
	svc, repo := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash", Currency: "VND"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	repo.seedTransactionForWallet(wallet.ID)

	sameCurrency := "VND"
	_, err = svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{Currency: &sameCurrency})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// S-WAL-25 / S-WAL-26: set-default swaps atomically, and calling it again on
// an already-default wallet is an idempotent no-op.
func TestWalletService_SetDefaultWallet_SwapThenIdempotentNoOp(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	first, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	second, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Bank", Type: "bank"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	updated, err := svc.SetDefaultWallet(context.Background(), userID, second.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.IsDefault {
		t.Fatalf("expected second wallet to become default")
	}

	refreshedFirst, err := svc.GetWallet(context.Background(), userID, first.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if refreshedFirst.IsDefault {
		t.Fatalf("expected first wallet to no longer be default")
	}

	// Calling set-default again on the now-default wallet is a no-op.
	again, err := svc.SetDefaultWallet(context.Background(), userID, second.ID)
	if err != nil {
		t.Fatalf("unexpected error on idempotent re-call: %v", err)
	}
	if !again.IsDefault {
		t.Fatalf("expected wallet to remain default")
	}
}

func strPtr(s string) *string { return &s }

// S-WBI-08/S-WBI-09/S-WBI-10 (specs/wallet-budget-icons/spec.md): icon/
// icon_url are fully optional and independently settable on Create.
func TestWalletService_CreateWallet_WithIconFields(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	withIcon, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{
		Name: "Cash", Type: "cash", Icon: strPtr("💵"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if withIcon.Icon == nil || *withIcon.Icon != "💵" {
		t.Fatalf("expected icon to be persisted, got %v", withIcon.Icon)
	}
	if withIcon.IconURL != nil {
		t.Fatalf("expected icon_url to remain nil, got %v", withIcon.IconURL)
	}

	withPhoto, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{
		Name: "Bank", Type: "bank", IconURL: strPtr("https://cdn.example/w.png"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if withPhoto.IconURL == nil || *withPhoto.IconURL != "https://cdn.example/w.png" {
		t.Fatalf("expected icon_url to be persisted, got %v", withPhoto.IconURL)
	}

	withNeither, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "E-Wallet", Type: "e_wallet"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if withNeither.Icon != nil || withNeither.IconURL != nil {
		t.Fatalf("expected both icon fields to remain nil when omitted, got icon=%v icon_url=%v", withNeither.Icon, withNeither.IconURL)
	}
}

// S-WBI-11/S-WBI-12 (specs/wallet-budget-icons/spec.md, plan.md Finding #1):
// an omitted icon_url key leaves the existing photo untouched, while an
// explicit `"icon_url": null` clears it — the exact distinction
// dto.OptionalString exists to make possible.
func TestWalletService_UpdateWallet_IconURLOmittedVsExplicitNull(t *testing.T) {
	svc, _ := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{
		Name: "Cash", Type: "cash", Icon: strPtr("💵"), IconURL: strPtr("https://cdn.example/w.png"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("omitted icon_url leaves the existing photo untouched", func(t *testing.T) {
		newName := "Cash Wallet"
		updated, err := svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{Name: &newName})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.IconURL == nil || *updated.IconURL != "https://cdn.example/w.png" {
			t.Fatalf("expected icon_url to remain untouched, got %v", updated.IconURL)
		}
	})

	t.Run("explicit null clears the photo", func(t *testing.T) {
		// dto.OptionalString{Set: true, Value: nil} is exactly what
		// UnmarshalJSON produces for `"icon_url": null` — constructed
		// directly here since the service layer never re-parses JSON.
		req := dto.UpdateWalletRequest{IconURL: dto.OptionalString{Set: true, Value: nil}}
		updated, err := svc.UpdateWallet(context.Background(), userID, wallet.ID, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.IconURL != nil {
			t.Fatalf("expected icon_url to be cleared, got %v", updated.IconURL)
		}
		if updated.Icon == nil || *updated.Icon != "💵" {
			t.Fatalf("expected icon (emoji) to survive an icon_url-only clear, got %v", updated.Icon)
		}
	})
}

// specs/wallet-budget-icons/spec.md Edge Case US-02 #3: icon fields are
// never gated by the currency lock, even once Transactions exist.
func TestWalletService_UpdateWallet_IconIndependentOfCurrencyLock(t *testing.T) {
	svc, repo := newTestWalletService(t)
	userID := uuid.New()

	wallet, err := svc.CreateWallet(context.Background(), userID, dto.CreateWalletRequest{Name: "Cash", Type: "cash", Currency: "VND"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	repo.seedTransactionForWallet(wallet.ID)

	updated, err := svc.UpdateWallet(context.Background(), userID, wallet.ID, dto.UpdateWalletRequest{Icon: strPtr("🏦")})
	if err != nil {
		t.Fatalf("expected icon update to succeed despite currency lock, got %v", err)
	}
	if updated.Icon == nil || *updated.Icon != "🏦" {
		t.Fatalf("expected icon to be updated, got %v", updated.Icon)
	}
}
