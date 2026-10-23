package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

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
			_, access, refresh, err := svc.Login(context.Background(), tt.email, tt.password, nil)
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

	_, _, _, wrongPasswordErr := svc.Login(context.Background(), "homer@example.com", "wrongpassword", nil)
	_, _, _, notFoundErr := svc.Login(context.Background(), "nobody@example.com", "anything1", nil)

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

	_, access, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
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

	refreshInfo, err := tokens.ParseRefreshToken(refresh)
	if err != nil {
		t.Fatalf("failed to parse refresh token: %v", err)
	}
	gotRefreshTTL := refreshInfo.ExpiresAt.Sub(time.Now().UTC())
	if gotRefreshTTL < common.RefreshTokenTTL-time.Minute || gotRefreshTTL > common.RefreshTokenTTL {
		t.Fatalf("expected refresh token TTL close to %v, got %v", common.RefreshTokenTTL, gotRefreshTTL)
	}
}

// TC-SEC-17, TC-SEC-18
func TestAuthService_Logout(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
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
	_, _, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1", nil)
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
