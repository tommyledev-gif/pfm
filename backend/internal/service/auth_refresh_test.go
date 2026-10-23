package service

import (
	"context"
	"errors"

	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// S-REF-01 through S-REF-08 (specs/mobile-session-refresh/spec.md).
func TestAuthService_Refresh(t *testing.T) {
	t.Run("happy path rotates the token and issues a new pair", func(t *testing.T) {
		svc, repo, revokedRepo := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}

		access, newRefresh, err := svc.Refresh(context.Background(), refresh, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if access == "" || newRefresh == "" {
			t.Fatal("expected non-empty access and refresh tokens")
		}
		if newRefresh == refresh {
			t.Fatal("expected a rotated (different) refresh token")
		}
		// A session token rotates inside its session row, not via the deny-list.
		if got := revokedRepo.revokedCount(); got != 0 {
			t.Fatalf("expected no deny-list rows for a session token, got %d", got)
		}
		if got := countRevokedSessions(svc); got != 0 {
			t.Fatalf("a normal refresh must not revoke the session, got %d revoked", got)
		}
	})

	// A refresh token from before sessions existed is traded once for a
	// session-bound pair, and cannot be traded again.
	t.Run("pre-session refresh token is upgraded to a session", func(t *testing.T) {
		svc, repo, revokedRepo := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		user, _ := repo.GetUserByEmail(context.Background(), "homer@example.com")
		_, legacy, err := svc.tokens.GenerateTokenPair(user)
		if err != nil {
			t.Fatal(err)
		}

		access, newRefresh, err := svc.Refresh(context.Background(), legacy, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		claims, _ := svc.tokens.ParseAccessToken(access)
		info, _ := svc.tokens.ParseRefreshToken(newRefresh)
		if claims.SessionID == "" || info.SessionID != claims.SessionID {
			t.Fatalf("the new pair must be bound to a session, got access sid %q refresh sid %q", claims.SessionID, info.SessionID)
		}
		if got := revokedRepo.revokedCount(); got != 1 {
			t.Fatalf("expected the old token on the deny-list (1 row), got %d", got)
		}

		_, _, err = svc.Refresh(context.Background(), legacy, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED when the old token is reused, got %v", err)
		}
	})

	// Replay of an old session token outside the grace window means a copy
	// leaked: the whole session is revoked (inside it, a retry is allowed —
	// see session_service_test.go).
	t.Run("reuse of an already-rotated token fails and revokes the session", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		_, current, err := svc.Refresh(context.Background(), refresh, nil)
		if err != nil {
			t.Fatalf("first refresh failed: %v", err)
		}
		fakeSessions(svc).clock.Advance(common.RefreshReuseGrace + time.Second)

		_, _, err = svc.Refresh(context.Background(), refresh, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED on reuse, got %v", err)
		}
		if _, _, err := svc.Refresh(context.Background(), current, nil); err == nil {
			t.Fatal("the session must be dead, including its newest refresh token")
		}
	})

	t.Run("logged-out token cannot be refreshed", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		if err := svc.Logout(context.Background(), refresh); err != nil {
			t.Fatalf("logout failed: %v", err)
		}

		_, _, err = svc.Refresh(context.Background(), refresh, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED, got %v", err)
		}
	})

	t.Run("expired refresh token is rejected", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		user, err := repo.GetUserByEmail(context.Background(), "homer@example.com")
		if err != nil {
			t.Fatalf("seed lookup failed: %v", err)
		}
		expired := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				ID:        uuid.NewString(),
				Subject:   user.ID.String(),
				IssuedAt:  jwt.NewNumericDate(time.Now().UTC().Add(-8 * 24 * time.Hour)),
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(-1 * time.Hour)),
			},
		})
		expiredStr, err := expired.SignedString(svc.tokens.signingKey)
		if err != nil {
			t.Fatalf("failed to sign expired token: %v", err)
		}

		_, _, err = svc.Refresh(context.Background(), expiredStr, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED, got %v", err)
		}
	})

	// ⚠️ The account-takeover case: a token for a real user, signed with a
	// key the attacker chose, must never be refreshed.
	t.Run("forged refresh token for a real user is rejected", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		user, err := repo.GetUserByEmail(context.Background(), "homer@example.com")
		if err != nil {
			t.Fatalf("seed lookup failed: %v", err)
		}
		forged := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				ID: uuid.NewString(), Subject: user.ID.String(),
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})
		forgedStr, err := forged.SignedString([]byte("attacker-chosen-key"))
		if err != nil {
			t.Fatalf("failed to sign forged token: %v", err)
		}

		_, _, err = svc.Refresh(context.Background(), forgedStr, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED for a forged token, got %v", err)
		}
	})

	t.Run("alg none token is rejected", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		user, _ := repo.GetUserByEmail(context.Background(), "homer@example.com")
		unsigned := jwt.NewWithClaims(jwt.SigningMethodNone, refreshClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				ID: uuid.NewString(), Subject: user.ID.String(),
				ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
			},
		})
		unsignedStr, err := unsigned.SignedString(jwt.UnsafeAllowNoneSignatureType)
		if err != nil {
			t.Fatalf("failed to build unsigned token: %v", err)
		}
		if _, _, err := svc.Refresh(context.Background(), unsignedStr, nil); err == nil {
			t.Fatal("expected an alg=none token to be rejected")
		}
	})

	t.Run("access token cannot be used as a refresh token", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, access, _, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		_, _, err = svc.Refresh(context.Background(), access, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED for an access token, got %v", err)
		}
	})

	t.Run("malformed refresh token is rejected as invalid input", func(t *testing.T) {
		svc, _, _ := newTestAuthService(t)
		_, _, err := svc.Refresh(context.Background(), "not-a-jwt", nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
			t.Fatalf("expected INVALID_INPUT, got %v", err)
		}
	})

	t.Run("disabled user cannot refresh", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		repo.mu.Lock()
		repo.byEmail["homer@example.com"].Status = model.UserStatusDisabled
		repo.mu.Unlock()

		_, _, err = svc.Refresh(context.Background(), refresh, nil)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED, got %v", err)
		}
	})

	t.Run("two devices refresh independently", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refreshA, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("device A login failed: %v", err)
		}
		_, _, refreshB, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
		if err != nil {
			t.Fatalf("device B login failed: %v", err)
		}

		if _, _, err := svc.Refresh(context.Background(), refreshA, nil); err != nil {
			t.Fatalf("device A refresh failed: %v", err)
		}
		if _, _, err := svc.Refresh(context.Background(), refreshB, nil); err != nil {
			t.Fatalf("device B refresh should still succeed independently: %v", err)
		}
		if got := countRevokedSessions(svc); got != 0 {
			t.Fatalf("refreshing one device must not end another's session, got %d revoked", got)
		}
	})
}
