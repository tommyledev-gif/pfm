package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// A refresh token with no `sid` is one this server could only have issued
// before sessions existed. Once those have all expired, one that still turns up
// is a forgery (for instance signed with a leaked key) and must not be traded
// for a session.
func TestAuthService_Refresh_PreSessionTokenWindow(t *testing.T) {
	ctx := context.Background()

	mint := func(t *testing.T, svc *AuthService, repo *fakeUserRepo) string {
		t.Helper()
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		user, _ := repo.GetUserByEmail(ctx, "homer@example.com")
		_, legacy, err := svc.tokens.GenerateTokenPair(user)
		if err != nil {
			t.Fatal(err)
		}
		return legacy
	}

	t.Run("accepted before the deadline", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		svc.SetLegacyRefreshDeadline(time.Now().Add(time.Hour))
		if _, _, err := svc.Refresh(ctx, mint(t, svc, repo)); err != nil {
			t.Fatalf("Refresh before the deadline: %v", err)
		}
	})

	t.Run("refused after the deadline", func(t *testing.T) {
		svc, repo, revoked := newTestAuthService(t)
		svc.SetLegacyRefreshDeadline(time.Now().Add(-time.Second))
		_, _, err := svc.Refresh(ctx, mint(t, svc, repo))
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
		if revoked.revokedCount() != 0 || countRevokedSessions(svc) != 0 {
			t.Fatal("a refused token must not leave any trace")
		}
	})

	t.Run("refused when no deadline was ever set", func(t *testing.T) {
		users := newFakeUserRepo()
		revoked := newFakeRevokedTokenRepo()
		tokens := NewTokenService("test-signing-key-not-for-production")
		clock := newTestClock()
		sessions := NewSessionService(newFakeSessionRepo(clock, users), tokens, zap.NewNop())
		svc := NewAuthService(users, revoked, tokens, sessions, zap.NewNop())

		_, _, err := svc.Refresh(ctx, mint(t, svc, users))
		wantAppCode(t, err, common.ErrCodeUnauthenticated)
	})

	t.Run("session tokens never depend on the window", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		svc.SetLegacyRefreshDeadline(time.Now().Add(-time.Hour))
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(ctx, "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := svc.Refresh(ctx, refresh); err != nil {
			t.Fatalf("a session refresh token must work whatever the legacy deadline is: %v", err)
		}
	})
}

// Switch claims the token (single use) before it creates the session. If
// creating the session then fails — a database blip — the claim is given back,
// so the client's retry works instead of finding the token spent and marking
// the account expired.
func TestAccountSwitchService_Switch_ReleasesTheTokenWhenTheSessionCannotBeCreated(t *testing.T) {
	ctx := context.Background()
	f := newSwitchFixture(t)
	user := seedUser(f.users, "a@example.com", model.UserStatusActive)
	token, _, err := f.tokens.IssueSwitchToken(user.ID)
	if err != nil {
		t.Fatal(err)
	}

	f.sessionRepo.failCreate = errors.New("connection reset")
	_, err = f.switches.Switch(ctx, token)
	if err == nil {
		t.Fatal("Switch must fail when the session cannot be created")
	}
	var appErr *common.AppError
	if errors.As(err, &appErr) {
		t.Fatalf("a database failure must not look like a credentials failure: %v", appErr)
	}
	if f.revoked.revokedCount() != 0 {
		t.Fatalf("the claim must be released, %d row(s) left", f.revoked.revokedCount())
	}

	f.sessionRepo.failCreate = nil
	if _, err := f.switches.Switch(ctx, token); err != nil {
		t.Fatalf("the same token must work on the retry: %v", err)
	}
	// And once it has worked it is spent, as before.
	_, err = f.switches.Switch(ctx, token)
	wantAppCode(t, err, common.ErrCodeUnauthenticated)
}
