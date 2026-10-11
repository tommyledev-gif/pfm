package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/example/pfm/backend/internal/model"
)

// fakeUserRepo's tên đăng nhập lookup and access-request methods, mirroring
// users_access.sql.go. Approval tokens live in byToken next to invite tokens:
// both are unique random hex, and each lookup checks the status it expects.

func (f *fakeUserRepo) GetUserByUsername(_ context.Context, username string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, u := range f.byEmail {
		if u.Username != nil && *u.Username == username {
			cp := *u
			return &cp, nil
		}
	}
	return nil, pgx.ErrNoRows
}

func (f *fakeUserRepo) CreateAccessRequest(_ context.Context, email string, adminID uuid.UUID, approvalToken string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.byEmail[email]; exists {
		return nil, &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_users_email_active_unique"}
	}
	now := time.Now().UTC()
	u := &model.User{
		ID:        uuid.New(),
		Email:     email,
		Status:    model.UserStatusRequested,
		Role:      model.UserRoleMember,
		InvitedBy: &adminID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	f.byEmail[email] = u
	f.byToken[approvalToken] = u
	return u, nil
}

func (f *fakeUserRepo) GetUserByApprovalToken(_ context.Context, approvalToken string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	u, ok := f.byToken[approvalToken]
	if !ok || u.Status != model.UserStatusRequested {
		return nil, pgx.ErrNoRows
	}
	cp := *u
	return &cp, nil
}

// ApproveAccessRequest mirrors the conditional UPDATE: only a still-requested
// row moves to pending, so a second approval gets pgx.ErrNoRows.
func (f *fakeUserRepo) ApproveAccessRequest(_ context.Context, id uuid.UUID, inviteToken string) (*model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for token, u := range f.byToken {
		if u.ID == id && u.Status == model.UserStatusRequested {
			delete(f.byToken, token)
		}
	}
	for _, u := range f.byEmail {
		if u.ID != id || u.Status != model.UserStatusRequested {
			continue
		}
		now := time.Now().UTC()
		expiresAt := now.Add(72 * time.Hour)
		u.Status = model.UserStatusPending
		u.InviteToken = &inviteToken
		u.InviteExpiresAt = &expiresAt
		u.InviteSentAt = &now
		u.InviteResendCount = 0
		f.byToken[inviteToken] = u
		cp := *u
		return &cp, nil
	}
	return nil, pgx.ErrNoRows
}
