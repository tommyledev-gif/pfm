package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

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
