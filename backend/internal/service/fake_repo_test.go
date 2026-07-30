package service

import (
	"bytes"
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeUserRepo is an in-memory stand-in for UserRepo, used instead of a real
// Postgres per Go Test Conventions ("mock Repository interface, test Service
// logic in isolation"). Its mutex makes CreatePendingUser and ActivateUser
// exercise the exact same race semantics the real conditional UPDATE/unique
// index provide — this is what makes the race tests in this package
// meaningful without testcontainers-go.
type fakeUserRepo struct {
	mu      sync.Mutex
	byEmail map[string]*model.User // only non-deleted users; empty slot after soft-delete
	byToken map[string]*model.User
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{
		byEmail: make(map[string]*model.User),
		byToken: make(map[string]*model.User),
	}
}

func (f *fakeUserRepo) CreatePendingUser(_ context.Context, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.byEmail[email]; exists {
		return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_users_email_active_unique"}
	}

	now := time.Now().UTC()
	expiresAt := now.Add(72 * time.Hour)
	u := &model.User{
		ID:              uuid.New(),
		Email:           email,
		Status:          model.UserStatusPending,
		Role:            role,
		InvitedBy:       &invitedBy,
		InviteToken:     &inviteToken,
		InviteExpiresAt: &expiresAt,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	f.byEmail[email] = u
	f.byToken[inviteToken] = u
	return u, nil
}

func (f *fakeUserRepo) GetUserByInviteToken(_ context.Context, token string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	u, ok := f.byToken[token]
	if !ok || u.Status != model.UserStatusPending {
		return nil, pgx.ErrNoRows
	}
	cp := *u
	return &cp, nil
}

// ActivateUser mirrors the real conditional UPDATE: acquiring the lock is
// the atomicity boundary, so exactly one of two concurrent callers for the
// same token observes status still "pending" and flips it.
func (f *fakeUserRepo) ActivateUser(_ context.Context, inviteToken string, fullName *string, passwordHash string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	u, ok := f.byToken[inviteToken]
	if !ok || u.Status != model.UserStatusPending {
		return nil, pgx.ErrNoRows
	}
	if u.InviteExpiresAt == nil || u.InviteExpiresAt.Before(time.Now().UTC()) {
		return nil, pgx.ErrNoRows
	}

	u.Status = model.UserStatusActive
	u.FullName = fullName
	ph := passwordHash
	u.PasswordHash = &ph
	now := time.Now().UTC()
	u.ActivatedAt = &now
	u.InviteToken = nil
	u.InviteExpiresAt = nil
	delete(f.byToken, inviteToken)

	cp := *u
	return &cp, nil
}

func (f *fakeUserRepo) GetUserByEmail(_ context.Context, email string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	u, ok := f.byEmail[email]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	cp := *u
	return &cp, nil
}

func (f *fakeUserRepo) GetUserByID(_ context.Context, id uuid.UUID) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, u := range f.byEmail {
		if u.ID == id {
			cp := *u
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeUserRepo) CountUserByEmailAnyStatus(_ context.Context, email string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, ok := f.byEmail[email]; ok {
		return 1, nil
	}
	return 0, nil
}

// ListUsers replicates the real query's ORDER BY created_at DESC, id DESC
// plus keyset-cursor filtering, so pagination tests exercise genuine cursor
// semantics rather than just returning the same page twice.
func (f *fakeUserRepo) ListUsers(_ context.Context, p repository.ListUsersParams) ([]*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var matched []*model.User
	for _, u := range f.byEmail {
		if p.Status != nil && string(u.Status) != *p.Status {
			continue
		}
		if p.Role != nil && string(u.Role) != *p.Role {
			continue
		}
		cp := *u
		matched = append(matched, &cp)
	}

	sort.Slice(matched, func(i, j int) bool {
		if !matched[i].CreatedAt.Equal(matched[j].CreatedAt) {
			return matched[i].CreatedAt.After(matched[j].CreatedAt)
		}
		return bytes.Compare(matched[i].ID[:], matched[j].ID[:]) > 0
	})

	var out []*model.User
	for _, u := range matched {
		if p.CursorCreatedAt != nil {
			if u.CreatedAt.After(*p.CursorCreatedAt) {
				continue
			}
			if u.CreatedAt.Equal(*p.CursorCreatedAt) && bytes.Compare(u.ID[:], (*p.CursorID)[:]) >= 0 {
				continue
			}
		}
		out = append(out, u)
		if int32(len(out)) >= p.Limit {
			break
		}
	}
	return out, nil
}

func (f *fakeUserRepo) CountUsers(_ context.Context, status, role *string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var count int64
	for _, u := range f.byEmail {
		if status != nil && string(u.Status) != *status {
			continue
		}
		if role != nil && string(u.Role) != *role {
			continue
		}
		count++
	}
	return count, nil
}

// fakeRevokedTokenRepo mirrors the ON CONFLICT DO NOTHING upsert semantics.
type fakeRevokedTokenRepo struct {
	mu      sync.Mutex
	revoked map[string]bool
}

func newFakeRevokedTokenRepo() *fakeRevokedTokenRepo {
	return &fakeRevokedTokenRepo{revoked: make(map[string]bool)}
}

func (f *fakeRevokedTokenRepo) Revoke(_ context.Context, tokenJTI string, _ *uuid.UUID, _ time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.revoked[tokenJTI] = true // idempotent: setting true twice is a no-op
	return nil
}

func (f *fakeRevokedTokenRepo) IsRevoked(_ context.Context, tokenJTI string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.revoked[tokenJTI], nil
}

// revokedCount exposes the underlying map size for the concurrency test's
// "exactly one row persisted" assertion (TC-SEC-22) — a real DB would assert
// this via `SELECT COUNT(*) FROM revoked_tokens WHERE token_jti = $1`.
func (f *fakeRevokedTokenRepo) revokedCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.revoked)
}
