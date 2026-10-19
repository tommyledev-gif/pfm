package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// Tên đăng nhập (mig 030): chosen at activation, then signs in like the email.
func TestAuthService_ActivateWithUsernameThenLoginByIt(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	token := newPendingInvite(t, svc, repo, "bart@example.com", time.Now().UTC().Add(72*time.Hour))

	user, _, _, err := svc.Activate(context.Background(), token, "  Bart.Simpson ", "Bart", "correcthorse1", "correcthorse1")
	if err != nil {
		t.Fatalf("Activate: %v", err)
	}
	if user.Username == nil || *user.Username != "bart.simpson" {
		t.Fatalf("username stored as %v, want lowercase trimmed bart.simpson", user.Username)
	}

	signedIn, access, refresh, err := svc.Login(context.Background(), "BART.SIMPSON", "correcthorse1", nil)
	if err != nil {
		t.Fatalf("Login by username: %v", err)
	}
	if signedIn.Email != "bart@example.com" || access == "" || refresh == "" {
		t.Fatalf("Login by username returned email %q, tokens %t/%t", signedIn.Email, access != "", refresh != "")
	}

	if _, _, _, err := svc.Login(context.Background(), "bart.simpson", "wrongpassword", nil); !errors.Is(err, common.ErrInvalidCredentials) {
		t.Fatalf("wrong password by username: got %v, want INVALID_CREDENTIALS", err)
	}
	if _, _, _, err := svc.Login(context.Background(), "nobody", "correcthorse1", nil); !errors.Is(err, common.ErrInvalidCredentials) {
		t.Fatalf("unknown username: got %v, want INVALID_CREDENTIALS", err)
	}
}

// A clash is 409 and leaves the invite usable, so the same link can retry.
func TestAuthService_ActivateUsernameTaken(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	first := newPendingInvite(t, svc, repo, "lisa@example.com", time.Now().UTC().Add(72*time.Hour))
	second := newPendingInvite(t, svc, repo, "maggie@example.com", time.Now().UTC().Add(72*time.Hour))

	if _, _, _, err := svc.Activate(context.Background(), first, "simpson", "", "correcthorse1", "correcthorse1"); err != nil {
		t.Fatalf("first Activate: %v", err)
	}
	if _, _, _, err := svc.Activate(context.Background(), second, "simpson", "", "correcthorse1", "correcthorse1"); !errors.Is(err, common.ErrUsernameTaken) {
		t.Fatalf("taken username: got %v, want USERNAME_TAKEN", err)
	}
	if _, _, _, err := svc.Activate(context.Background(), second, "maggie", "", "correcthorse1", "correcthorse1"); err != nil {
		t.Fatalf("retry with another username on the same invite: %v", err)
	}
}

func TestAuthService_ActivateInvalidUsername(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	token := newPendingInvite(t, svc, repo, "ned@example.com", time.Now().UTC().Add(72*time.Hour))

	_, _, _, err := svc.Activate(context.Background(), token, "", "", "correcthorse1", "correcthorse1")
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidUsername {
		t.Fatalf("empty username: got %v, want INVALID_USERNAME", err)
	}
}

func TestAuthService_LoginAwaitingApproval(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	seedActiveUser(t, repo, "waiting@example.com", "correcthorse1", model.UserStatusRequested)

	if _, _, _, err := svc.Login(context.Background(), "waiting@example.com", "correcthorse1", nil); !errors.Is(err, common.ErrAccountAwaitingApproval) {
		t.Fatalf("got %v, want ACCOUNT_AWAITING_APPROVAL", err)
	}
}

// Same rule as chk_users_username_format (mig 030).
func TestUsernameProblem(t *testing.T) {
	valid := []string{"abc", "bart.simpson", "bart_2", "a1b", "abcdefghijabcdefghijabcdefghij"}
	invalid := []string{"", "ab", "abcdefghijabcdefghijabcdefghijk", "1abc", "_abc", "abc.", "abc_", "a..b", "a._b", "bà", "a b", "a@b.c", "a-b"}
	for _, u := range valid {
		if p := common.UsernameProblem(u); p != "" {
			t.Errorf("UsernameProblem(%q) = %q, want valid", u, p)
		}
	}
	for _, u := range invalid {
		if common.UsernameProblem(u) == "" {
			t.Errorf("UsernameProblem(%q) = valid, want a problem", u)
		}
	}
}
