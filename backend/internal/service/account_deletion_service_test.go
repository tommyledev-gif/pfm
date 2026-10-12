package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// fakeDeletionRepo is an in-memory AccountDeletionRepo. SearchUsers matches
// the escaped pattern as written, so a test can see what was escaped.
type fakeDeletionRepo struct {
	users       map[uuid.UUID]*model.User
	lastPattern string
}

func (f *fakeDeletionRepo) GetUserByID(_ context.Context, id uuid.UUID) (*model.User, error) {
	u, ok := f.users[id]
	if !ok || u.DeletedAt != nil {
		return nil, fmt.Errorf("fake.GetUserByID: %w", pgx.ErrNoRows)
	}
	return u, nil
}

func (f *fakeDeletionRepo) SearchUsers(_ context.Context, pattern string, limit int32) ([]*model.User, error) {
	f.lastPattern = pattern
	var out []*model.User
	for _, u := range f.users {
		if u.DeletedAt == nil && strings.Contains(u.Email, pattern) && int32(len(out)) < limit {
			out = append(out, u)
		}
	}
	return out, nil
}

func (f *fakeDeletionRepo) SoftDeleteUser(_ context.Context, id uuid.UUID) (*model.User, error) {
	u, ok := f.users[id]
	if !ok || u.DeletedAt != nil {
		return nil, fmt.Errorf("fake.SoftDeleteUser: %w", pgx.ErrNoRows)
	}
	now := time.Now().UTC()
	u.DeletedAt = &now
	return u, nil
}

type fakeSessionEnder struct {
	ended  map[uuid.UUID]string
	failed bool
}

func (f *fakeSessionEnder) EndAll(_ context.Context, userID uuid.UUID, reason string) error {
	if f.failed {
		return errors.New("session store down")
	}
	f.ended[userID] = reason
	return nil
}

type deletionFixture struct {
	svc      *AccountDeletionService
	repo     *fakeDeletionRepo
	sessions *fakeSessionEnder
	operator *model.User
}

func newDeletionFixture() *deletionFixture {
	f := &deletionFixture{
		repo:     &fakeDeletionRepo{users: map[uuid.UUID]*model.User{}},
		sessions: &fakeSessionEnder{ended: map[uuid.UUID]string{}},
	}
	f.svc = NewAccountDeletionService(f.repo, f.sessions, zap.NewNop())
	f.operator = f.add(common.AccountDeletionOperatorEmail)
	return f
}

func (f *deletionFixture) add(email string) *model.User {
	u := &model.User{ID: uuid.New(), Email: email, Status: model.UserStatusActive, Role: model.UserRoleMember}
	f.repo.users[u.ID] = u
	return u
}

func TestAccountDeletionService_DeleteUser(t *testing.T) {
	ctx := context.Background()

	t.Run("operator soft-deletes another account and ends its sessions", func(t *testing.T) {
		f := newDeletionFixture()
		target := f.add("m@example.com")
		if err := f.svc.DeleteUser(ctx, f.operator.ID, target.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if target.DeletedAt == nil {
			t.Fatal("target not soft-deleted")
		}
		if f.sessions.ended[target.ID] != model.SessionRevokedAdmin {
			t.Fatalf("sessions not ended with the admin reason: %v", f.sessions.ended)
		}
	})

	t.Run("anyone else is forbidden, even another admin", func(t *testing.T) {
		f := newDeletionFixture()
		other := f.add("admin2@example.com")
		other.Role = model.UserRoleAdmin
		target := f.add("m@example.com")
		wantAppCode(t, f.svc.DeleteUser(ctx, other.ID, target.ID), common.ErrCodeForbidden)
		if target.DeletedAt != nil {
			t.Fatal("target deleted by a non-operator")
		}
	})

	t.Run("deleting yourself is invalid input", func(t *testing.T) {
		f := newDeletionFixture()
		wantAppCode(t, f.svc.DeleteUser(ctx, f.operator.ID, f.operator.ID), common.ErrCodeInvalidInput)
	})

	t.Run("unknown or already deleted target is not found", func(t *testing.T) {
		f := newDeletionFixture()
		wantAppCode(t, f.svc.DeleteUser(ctx, f.operator.ID, uuid.New()), common.ErrCodeNotFound)
		target := f.add("m@example.com")
		if err := f.svc.DeleteUser(ctx, f.operator.ID, target.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		wantAppCode(t, f.svc.DeleteUser(ctx, f.operator.ID, target.ID), common.ErrCodeNotFound)
	})

	t.Run("a session clean-up failure does not fail the delete", func(t *testing.T) {
		f := newDeletionFixture()
		f.sessions.failed = true
		target := f.add("m@example.com")
		if err := f.svc.DeleteUser(ctx, f.operator.ID, target.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if target.DeletedAt == nil {
			t.Fatal("target not soft-deleted")
		}
	})
}

func TestAccountDeletionService_SearchUsers(t *testing.T) {
	ctx := context.Background()

	t.Run("matches case-insensitively and leaves the caller out", func(t *testing.T) {
		f := newDeletionFixture()
		f.add("owner@example.com")
		got, err := f.svc.SearchUsers(ctx, f.operator.ID, "  example ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 1 || got[0].Email != "owner@example.com" {
			t.Fatalf("want only example.dev, got %v", got)
		}
	})

	t.Run("LIKE wildcards are escaped", func(t *testing.T) {
		f := newDeletionFixture()
		if _, err := f.svc.SearchUsers(ctx, f.operator.ID, `a_b%c\d`); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if f.repo.lastPattern != `a\_b\%c\\d` {
			t.Fatalf("pattern not escaped: %q", f.repo.lastPattern)
		}
	})

	t.Run("blank query returns nothing without searching", func(t *testing.T) {
		f := newDeletionFixture()
		got, err := f.svc.SearchUsers(ctx, f.operator.ID, "   ")
		if err != nil || len(got) != 0 || f.repo.lastPattern != "" {
			t.Fatalf("want empty result and no search, got %v, %v, %q", got, err, f.repo.lastPattern)
		}
	})

	t.Run("anyone else is forbidden", func(t *testing.T) {
		f := newDeletionFixture()
		member := f.add("m@example.com")
		_, err := f.svc.SearchUsers(ctx, member.ID, "m")
		wantAppCode(t, err, common.ErrCodeForbidden)
	})
}
