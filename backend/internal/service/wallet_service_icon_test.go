package service

import (
	"context"

	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
)

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
