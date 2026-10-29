package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// noopEmailSender never fails and does nothing — InviteUser's fire-and-forget
// goroutine still runs against it in tests, but nothing asserts on it here.
type noopEmailSender struct{}

func (noopEmailSender) SendActivationEmail(context.Context, string, string) error { return nil }
func (noopEmailSender) SendAccessRequestEmail(context.Context, string, string, string) error {
	return nil
}
func (noopEmailSender) SendAccessApprovedEmail(context.Context, string, string) error { return nil }
func (noopEmailSender) SendPasswordResetCode(context.Context, string, string) error   { return nil }
func (noopEmailSender) SendWalletInviteEmail(context.Context, string, string, string, string) error {
	return nil
}

func newTestUserService(t *testing.T) (*UserService, *fakeUserRepo) {
	t.Helper()
	repo := newFakeUserRepo()
	return NewUserService(repo, noopEmailSender{}, zap.NewNop()), repo
}

// TC-USR-01 (happy path, role defaults to member), TC-USR-02/03 (duplicate email).
func TestUserService_InviteUser(t *testing.T) {
	svc, repo := newTestUserService(t)
	adminID := uuid.New()

	t.Run("happy path defaults role to member", func(t *testing.T) {
		user, err := svc.InviteUser(context.Background(), adminID, "homer@example.com", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.Role != model.UserRoleMember {
			t.Fatalf("expected default role member, got %s", user.Role)
		}
		if user.Status != model.UserStatusPending {
			t.Fatalf("expected status pending, got %s", user.Status)
		}
	})

	t.Run("duplicate email, existing active user", func(t *testing.T) {
		seedActiveUser(t, repo, "active@example.com", "correcthorse1", model.UserStatusActive)
		_, err := svc.InviteUser(context.Background(), adminID, "active@example.com", "")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeEmailAlreadyExists {
			t.Fatalf("expected EMAIL_ALREADY_EXISTS, got %v", err)
		}
	})

	t.Run("duplicate email, existing pending invite", func(t *testing.T) {
		if _, err := svc.InviteUser(context.Background(), adminID, "pending@example.com", ""); err != nil {
			t.Fatalf("setup invite failed: %v", err)
		}
		_, err := svc.InviteUser(context.Background(), adminID, "pending@example.com", "")
		var appErr *common.AppError
		if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeEmailAlreadyExists {
			t.Fatalf("expected EMAIL_ALREADY_EXISTS, got %v", err)
		}
	})
}

// TC-USR-15: two admins concurrently invite the exact same new email — only one succeeds.
func TestUserService_InviteUser_ConcurrentRace(t *testing.T) {
	svc, _ := newTestUserService(t)
	adminID := uuid.New()

	var wg sync.WaitGroup
	errs := make([]error, 2)
	start := make(chan struct{})
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			_, errs[idx] = svc.InviteUser(context.Background(), adminID, "race@example.com", "")
		}(i)
	}
	close(start)
	wg.Wait()

	successCount, conflictCount := 0, 0
	for _, err := range errs {
		if err == nil {
			successCount++
			continue
		}
		var appErr *common.AppError
		if errors.As(err, &appErr) && appErr.Code == common.ErrCodeEmailAlreadyExists {
			conflictCount++
		}
	}
	if successCount != 1 || conflictCount != 1 {
		t.Fatalf("expected exactly 1 success and 1 EMAIL_ALREADY_EXISTS, got %d successes and %d conflicts", successCount, conflictCount)
	}
}

func seedUserAt(repo *fakeUserRepo, email string, createdAt time.Time) {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	repo.byEmail[email] = &model.User{
		ID:        uuid.New(),
		Email:     email,
		Status:    model.UserStatusActive,
		Role:      model.UserRoleMember,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

// TC-USR-41: cursor pagination returns the next page correctly and terminates.
func TestUserService_ListUsers_CursorPagination(t *testing.T) {
	svc, repo := newTestUserService(t)
	base := time.Now().UTC()
	emails := []string{"u1@example.com", "u2@example.com", "u3@example.com", "u4@example.com", "u5@example.com"}
	for i, email := range emails {
		seedUserAt(repo, email, base.Add(time.Duration(-i)*time.Minute)) // u1 newest, u5 oldest
	}

	seen := make(map[string]bool)
	cursor := ""
	pages := 0
	for {
		pages++
		if pages > 10 {
			t.Fatal("pagination did not terminate after 10 pages")
		}
		users, nextCursor, total, err := svc.ListUsers(context.Background(), "", "", cursor, 2)
		if err != nil {
			t.Fatalf("ListUsers failed: %v", err)
		}
		if total != int64(len(emails)) {
			t.Fatalf("expected total %d, got %d", len(emails), total)
		}
		for _, u := range users {
			if seen[u.Email] {
				t.Fatalf("email %s returned on more than one page", u.Email)
			}
			seen[u.Email] = true
		}
		if nextCursor == nil {
			break
		}
		cursor = *nextCursor
	}

	if len(seen) != len(emails) {
		t.Fatalf("expected all %d users to be seen exactly once, saw %d", len(emails), len(seen))
	}
}

// TC-USR-20: filters that match zero users return an empty (non-nil) list, not an error.
func TestUserService_ListUsers_EmptyResult(t *testing.T) {
	svc, repo := newTestUserService(t)
	seedUserAt(repo, "someone@example.com", time.Now().UTC())

	users, nextCursor, total, err := svc.ListUsers(context.Background(), "disabled", "", "", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 0 {
		t.Fatalf("expected 0 users, got %d", len(users))
	}
	if nextCursor != nil {
		t.Fatalf("expected nil next_cursor, got %v", *nextCursor)
	}
	if total != 0 {
		t.Fatalf("expected total 0, got %d", total)
	}
}
