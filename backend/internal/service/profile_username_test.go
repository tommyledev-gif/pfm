package service

import (
	"context"
	"errors"
	"testing"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func wantAppError(t *testing.T, err error, code string) *common.AppError {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != code {
		t.Fatalf("err = %v, want %s", err, code)
	}
	return appErr
}

func TestProfileClaimUsernameStoresTheNormalisedName(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	got, err := svc.ClaimUsername(context.Background(), user.ID, "  Lan.Nguyen ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Username == nil || *got.Username != "lan.nguyen" {
		t.Fatalf("username = %v, want lan.nguyen", got.Username)
	}
}

func TestProfileClaimUsernameIsOnceOnly(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	if _, err := svc.ClaimUsername(context.Background(), user.ID, "lan.nguyen"); err != nil {
		t.Fatalf("first claim: %v", err)
	}
	_, err := svc.ClaimUsername(context.Background(), user.ID, "lan.khac")
	wantAppError(t, err, common.ErrCodeUsernameAlreadySet)
}

func TestProfileClaimUsernameTakenByAnotherAccount(t *testing.T) {
	svc, users, _, user := newProfileFixture(t)
	other := seedUser(users, "b@example.com", model.UserStatusActive)
	if _, err := svc.ClaimUsername(context.Background(), other.ID, "lan.nguyen"); err != nil {
		t.Fatalf("other's claim: %v", err)
	}
	_, err := svc.ClaimUsername(context.Background(), user.ID, "LAN.NGUYEN")
	wantAppError(t, err, common.ErrCodeUsernameTaken)

	// The refused claim left the account free to pick another.
	if _, err := svc.ClaimUsername(context.Background(), user.ID, "lan.nguyen2"); err != nil {
		t.Fatalf("second try with a free name: %v", err)
	}
}

func TestProfileClaimUsernameRejectsABadFormat(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	for _, raw := range []string{"", "ab", "1lan", "lan..nguyen", "lan_", "lan nguyen", "lân"} {
		_, err := svc.ClaimUsername(context.Background(), user.ID, raw)
		appErr := wantAppError(t, err, common.ErrCodeInvalidUsername)
		if appErr.Message == "" {
			t.Fatalf("%q: INVALID_USERNAME without a message", raw)
		}
	}
}

func TestProfileClaimUsernameUnknownUserIsUnauthenticated(t *testing.T) {
	svc, _, _, _ := newProfileFixture(t)
	ghost := seedUser(newFakeUserRepo(), "ghost@example.com", model.UserStatusActive)
	if _, err := svc.ClaimUsername(context.Background(), ghost.ID, "ghost.user"); !errors.Is(err, common.ErrUnauthenticated) {
		t.Fatalf("err = %v, want ErrUnauthenticated", err)
	}
}
