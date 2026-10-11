package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

func newTestAuthService(t *testing.T) (*AuthService, *fakeUserRepo, *fakeRevokedTokenRepo) {
	t.Helper()
	userRepo := newFakeUserRepo()
	revokedRepo := newFakeRevokedTokenRepo()
	tokens := NewTokenService("test-signing-key-not-for-production")
	clock := newTestClock()
	sessions := NewSessionService(newFakeSessionRepo(clock, userRepo), tokens, zap.NewNop())
	sessions.now = clock.Now
	svc := NewAuthService(userRepo, revokedRepo, tokens, sessions, zap.NewNop())
	// Open for the whole test: the legacy-token tests need it; the deadline
	// itself is covered in auth_legacy_and_switch_release_test.go.
	svc.SetLegacyRefreshDeadline(time.Now().Add(24 * time.Hour))
	return svc, userRepo, revokedRepo
}

func seedActiveUser(t *testing.T, repo *fakeUserRepo, email, password string, status model.UserStatus) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), common.BcryptCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	hashStr := string(hash)
	repo.mu.Lock()
	repo.byEmail[email] = &model.User{
		Status:       status,
		Role:         model.UserRoleMember,
		Email:        email,
		PasswordHash: &hashStr,
	}
	repo.mu.Unlock()
}

// TC-SEC-01, TC-SEC-04, TC-SEC-05, TC-SEC-07, TC-SEC-08
func TestAuthService_Login(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	seedActiveUser(t, repo, "pending@example.com", "correcthorse1", model.UserStatusPending)
	seedActiveUser(t, repo, "disabled@example.com", "correcthorse1", model.UserStatusDisabled)

	tests := []struct {
		name     string
		email    string
		password string
		wantErr  *common.AppError
	}{
		{"happy path", "homer@example.com", "correcthorse1", nil},
		{"wrong password", "homer@example.com", "wrongpassword", common.ErrInvalidCredentials},
		{"email not found", "nobody@example.com", "anything1", common.ErrInvalidCredentials},
		{"pending account", "pending@example.com", "correcthorse1", common.ErrAccountNotActive},
		{"disabled account", "disabled@example.com", "correcthorse1", common.ErrAccountDisabled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, access, refresh, err := svc.Login(context.Background(), tt.email, tt.password)
			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("expected success, got error: %v", err)
				}
				if access == "" || refresh == "" {
					t.Fatal("expected non-empty access and refresh tokens")
				}
				return
			}
			var appErr *common.AppError
			if !errors.As(err, &appErr) {
				t.Fatalf("expected *common.AppError, got %T: %v", err, err)
			}
			if appErr.Code != tt.wantErr.Code {
				t.Fatalf("expected code %s, got %s", tt.wantErr.Code, appErr.Code)
			}
		})
	}
}

// TC-SEC-06: wrong-password and email-not-found must be byte-identical.
func TestAuthService_Login_EnumerationProtection(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)

	_, _, _, wrongPasswordErr := svc.Login(context.Background(), "homer@example.com", "wrongpassword")
	_, _, _, notFoundErr := svc.Login(context.Background(), "nobody@example.com", "anything1")

	var wrongPwAppErr, notFoundAppErr *common.AppError
	if !errors.As(wrongPasswordErr, &wrongPwAppErr) || !errors.As(notFoundErr, &notFoundAppErr) {
		t.Fatal("expected both errors to be *common.AppError")
	}
	if wrongPwAppErr.Code != notFoundAppErr.Code || wrongPwAppErr.Status != notFoundAppErr.Status || wrongPwAppErr.Message != notFoundAppErr.Message {
		t.Fatalf("expected identical error bodies, got %+v vs %+v", wrongPwAppErr, notFoundAppErr)
	}
}

// TC-SEC-12, TC-SEC-13
func TestAuthService_Login_TokenExpiry(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	tokens := svc.tokens

	_, access, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	accessClaims, err := tokens.ParseAccessToken(access)
	if err != nil {
		t.Fatalf("failed to parse access token: %v", err)
	}
	gotAccessTTL := accessClaims.ExpiresAt.Time.Sub(accessClaims.IssuedAt.Time)
	if gotAccessTTL != common.AccessTokenTTL {
		t.Fatalf("expected access token TTL %v, got %v", common.AccessTokenTTL, gotAccessTTL)
	}

	_, _, refreshExpiresAt, err := tokens.ParseRefreshTokenUnverified(refresh)
	if err != nil {
		t.Fatalf("failed to parse refresh token: %v", err)
	}
	gotRefreshTTL := refreshExpiresAt.Sub(time.Now().UTC())
	if gotRefreshTTL < common.RefreshTokenTTL-time.Minute || gotRefreshTTL > common.RefreshTokenTTL {
		t.Fatalf("expected refresh token TTL close to %v, got %v", common.RefreshTokenTTL, gotRefreshTTL)
	}
}

// TC-SEC-17, TC-SEC-18
func TestAuthService_Logout(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if err := svc.Logout(context.Background(), refresh); err != nil {
		t.Fatalf("first logout failed: %v", err)
	}
	if err := svc.Logout(context.Background(), refresh); err != nil {
		t.Fatalf("second (idempotent) logout failed: %v", err)
	}
	// A session-bound token ends its session; the deny-list is not involved.
	if got := countRevokedSessions(svc); got != 1 {
		t.Fatalf("expected exactly 1 revoked session, got %d", got)
	}
	if got := revokedRepo.revokedCount(); got != 0 {
		t.Fatalf("a session token must not touch the deny-list, got %d rows", got)
	}
}

// A refresh token issued before sessions existed has no sid: logout takes the
// old path and puts its jti on the deny-list.
func TestAuthService_Logout_LegacyToken(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	user, _ := repo.GetUserByEmail(context.Background(), "homer@example.com")
	_, legacyRefresh, err := svc.tokens.GenerateTokenPair(user)
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 2; i++ {
		if err := svc.Logout(context.Background(), legacyRefresh); err != nil {
			t.Fatalf("logout %d failed: %v", i, err)
		}
	}
	if got := revokedRepo.revokedCount(); got != 1 {
		t.Fatalf("expected exactly 1 revoked row, got %d", got)
	}
}

// TC-SEC-22: concurrent double-logout — both succeed, exactly one row persisted.
func TestAuthService_Logout_ConcurrentRace(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	var wg sync.WaitGroup
	errs := make([]error, 2)
	start := make(chan struct{})
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			errs[idx] = svc.Logout(context.Background(), refresh)
		}(i)
	}
	close(start)
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("logout %d returned unexpected error: %v", i, err)
		}
	}
	if got := countRevokedSessions(svc); got != 1 {
		t.Fatalf("expected exactly 1 revoked session after concurrent logout, got %d", got)
	}
	_ = revokedRepo
}

// S-REF-01 through S-REF-08 (specs/mobile-session-refresh/spec.md).
func TestAuthService_Refresh(t *testing.T) {
	t.Run("happy path rotates the token and issues a new pair", func(t *testing.T) {
		svc, repo, revokedRepo := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}

		access, newRefresh, err := svc.Refresh(context.Background(), refresh)
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

		access, newRefresh, err := svc.Refresh(context.Background(), legacy)
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

		_, _, err = svc.Refresh(context.Background(), legacy)
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
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		_, current, err := svc.Refresh(context.Background(), refresh)
		if err != nil {
			t.Fatalf("first refresh failed: %v", err)
		}
		fakeSessions(svc).clock.Advance(common.RefreshReuseGrace + time.Second)

		_, _, err = svc.Refresh(context.Background(), refresh)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED on reuse, got %v", err)
		}
		if _, _, err := svc.Refresh(context.Background(), current); err == nil {
			t.Fatal("the session must be dead, including its newest refresh token")
		}
	})

	t.Run("logged-out token cannot be refreshed", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		if err := svc.Logout(context.Background(), refresh); err != nil {
			t.Fatalf("logout failed: %v", err)
		}

		_, _, err = svc.Refresh(context.Background(), refresh)
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

		_, _, err = svc.Refresh(context.Background(), expiredStr)
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

		_, _, err = svc.Refresh(context.Background(), forgedStr)
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
		if _, _, err := svc.Refresh(context.Background(), unsignedStr); err == nil {
			t.Fatal("expected an alg=none token to be rejected")
		}
	})

	t.Run("access token cannot be used as a refresh token", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, access, _, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		_, _, err = svc.Refresh(context.Background(), access)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED for an access token, got %v", err)
		}
	})

	t.Run("malformed refresh token is rejected as invalid input", func(t *testing.T) {
		svc, _, _ := newTestAuthService(t)
		_, _, err := svc.Refresh(context.Background(), "not-a-jwt")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
			t.Fatalf("expected INVALID_INPUT, got %v", err)
		}
	})

	t.Run("disabled user cannot refresh", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("login failed: %v", err)
		}
		repo.mu.Lock()
		repo.byEmail["homer@example.com"].Status = model.UserStatusDisabled
		repo.mu.Unlock()

		_, _, err = svc.Refresh(context.Background(), refresh)
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeUnauthenticated {
			t.Fatalf("expected UNAUTHENTICATED, got %v", err)
		}
	})

	t.Run("two devices refresh independently", func(t *testing.T) {
		svc, repo, _ := newTestAuthService(t)
		seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
		_, _, refreshA, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("device A login failed: %v", err)
		}
		_, _, refreshB, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
		if err != nil {
			t.Fatalf("device B login failed: %v", err)
		}

		if _, _, err := svc.Refresh(context.Background(), refreshA); err != nil {
			t.Fatalf("device A refresh failed: %v", err)
		}
		if _, _, err := svc.Refresh(context.Background(), refreshB); err != nil {
			t.Fatalf("device B refresh should still succeed independently: %v", err)
		}
		if got := countRevokedSessions(svc); got != 0 {
			t.Fatalf("refreshing one device must not end another's session, got %d revoked", got)
		}
	})
}

func newPendingInvite(t *testing.T, svc *AuthService, repo *fakeUserRepo, email string, expiresAt time.Time) string {
	t.Helper()
	token, err := generateInviteToken()
	if err != nil {
		t.Fatalf("failed to generate invite token: %v", err)
	}
	now := time.Now().UTC()
	repo.mu.Lock()
	u := &model.User{
		Email:           email,
		Status:          model.UserStatusPending,
		Role:            model.UserRoleMember,
		InviteToken:     &token,
		InviteExpiresAt: &expiresAt,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	repo.byEmail[email] = u
	repo.byToken[token] = u
	repo.mu.Unlock()
	return token
}

// TC-USR-09 (happy path), TC-USR-10 (not found), TC-USR-11 (expired),
// TC-USR-13 (weak password), TC-USR-15 (mismatch).
func TestAuthService_Activate(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)

	validToken := newPendingInvite(t, svc, repo, "visitor@example.com", time.Now().UTC().Add(72*time.Hour))
	expiredToken := newPendingInvite(t, svc, repo, "expired@example.com", time.Now().UTC().Add(-1*time.Hour))

	t.Run("token not found", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), "does-not-exist", "homer", "", "correcthorse1", "correcthorse1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeNotFound {
			t.Fatalf("expected NOT_FOUND, got %v", err)
		}
	})

	t.Run("token expired", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), expiredToken, "homer", "", "correcthorse1", "correcthorse1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeTokenExpired {
			t.Fatalf("expected TOKEN_EXPIRED, got %v", err)
		}
	})

	t.Run("weak password", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), validToken, "homer", "", "short1", "short1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWeakPassword {
			t.Fatalf("expected WEAK_PASSWORD, got %v", err)
		}
	})

	t.Run("password mismatch", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), validToken, "homer", "", "correcthorse1", "different1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodePasswordMismatch {
			t.Fatalf("expected PASSWORD_MISMATCH, got %v", err)
		}
	})

	t.Run("happy path", func(t *testing.T) {
		user, access, refresh, err := svc.Activate(context.Background(), validToken, "homer", "Homer", "correcthorse1", "correcthorse1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.Status != model.UserStatusActive {
			t.Fatalf("expected status active, got %s", user.Status)
		}
		if access == "" || refresh == "" {
			t.Fatal("expected non-empty tokens")
		}
	})
}

// TC-USR-16/26: exactly one of two concurrent activations with the same
// token succeeds; the other gets NOT_FOUND.
func TestAuthService_Activate_ConcurrentRace(t *testing.T) {
	svc, repo, _ := newTestAuthService(t)
	token := newPendingInvite(t, svc, repo, "race@example.com", time.Now().UTC().Add(72*time.Hour))

	var wg sync.WaitGroup
	type result struct {
		err error
	}
	results := make([]result, 2)
	start := make(chan struct{})
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			_, _, _, err := svc.Activate(context.Background(), token, "homer", "Race", "correcthorse1", "correcthorse1")
			results[idx] = result{err: err}
		}(i)
	}
	close(start)
	wg.Wait()

	successCount, notFoundCount := 0, 0
	for _, r := range results {
		if r.err == nil {
			successCount++
			continue
		}
		var appErr *common.AppError
		if errors.As(r.err, &appErr) && appErr.Code == common.ErrCodeNotFound {
			notFoundCount++
		}
	}
	if successCount != 1 || notFoundCount != 1 {
		t.Fatalf("expected exactly 1 success and 1 NOT_FOUND, got %d successes and %d not-found", successCount, notFoundCount)
	}
}
