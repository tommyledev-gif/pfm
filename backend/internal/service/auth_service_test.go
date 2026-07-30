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
	return NewAuthService(userRepo, revokedRepo, tokens, zap.NewNop()), userRepo, revokedRepo
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
			access, refresh, err := svc.Login(context.Background(), tt.email, tt.password)
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

	_, _, wrongPasswordErr := svc.Login(context.Background(), "homer@example.com", "wrongpassword")
	_, _, notFoundErr := svc.Login(context.Background(), "nobody@example.com", "anything1")

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

	access, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
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
	_, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if err := svc.Logout(context.Background(), refresh); err != nil {
		t.Fatalf("first logout failed: %v", err)
	}
	if err := svc.Logout(context.Background(), refresh); err != nil {
		t.Fatalf("second (idempotent) logout failed: %v", err)
	}
	if got := revokedRepo.revokedCount(); got != 1 {
		t.Fatalf("expected exactly 1 revoked row, got %d", got)
	}
}

// TC-SEC-22: concurrent double-logout — both succeed, exactly one row persisted.
func TestAuthService_Logout_ConcurrentRace(t *testing.T) {
	svc, repo, revokedRepo := newTestAuthService(t)
	seedActiveUser(t, repo, "homer@example.com", "correcthorse1", model.UserStatusActive)
	_, refresh, err := svc.Login(context.Background(), "homer@example.com", "correcthorse1")
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
	if got := revokedRepo.revokedCount(); got != 1 {
		t.Fatalf("expected exactly 1 revoked row after concurrent logout, got %d", got)
	}
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
		_, _, _, err := svc.Activate(context.Background(), "does-not-exist", "", "correcthorse1", "correcthorse1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeNotFound {
			t.Fatalf("expected NOT_FOUND, got %v", err)
		}
	})

	t.Run("token expired", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), expiredToken, "", "correcthorse1", "correcthorse1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeTokenExpired {
			t.Fatalf("expected TOKEN_EXPIRED, got %v", err)
		}
	})

	t.Run("weak password", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), validToken, "", "short1", "short1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeWeakPassword {
			t.Fatalf("expected WEAK_PASSWORD, got %v", err)
		}
	})

	t.Run("password mismatch", func(t *testing.T) {
		_, _, _, err := svc.Activate(context.Background(), validToken, "", "correcthorse1", "different1")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodePasswordMismatch {
			t.Fatalf("expected PASSWORD_MISMATCH, got %v", err)
		}
	})

	t.Run("happy path", func(t *testing.T) {
		user, access, refresh, err := svc.Activate(context.Background(), validToken, "Homer", "correcthorse1", "correcthorse1")
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
			_, _, _, err := svc.Activate(context.Background(), token, "Race", "correcthorse1", "correcthorse1")
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
