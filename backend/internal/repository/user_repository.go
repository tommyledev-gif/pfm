package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// UserRepository wraps the sqlc-generated queries and returns domain models,
// never sqlc's raw row structs. It contains no business rules — "not found"
// vs. "expired" vs. "already consumed" is a service-layer decision made by
// inspecting the error/row returned here.
type UserRepository struct {
	q *sqlc.Queries
}

func NewUserRepository(q *sqlc.Queries) *UserRepository {
	return &UserRepository{q: q}
}

type ListUsersParams struct {
	Status          *string
	Role            *string
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
	Limit           int32
}

func (r *UserRepository) CreatePendingUser(ctx context.Context, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error) {
	row, err := r.q.CreatePendingUser(ctx, sqlc.CreatePendingUserParams{
		Email:       email,
		Role:        string(role),
		InvitedBy:   &invitedBy,
		InviteToken: inviteToken,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.CreatePendingUser: %w", err)
	}
	return toModel(row), nil
}

// GetUserByInviteToken returns pgx.ErrNoRows (unwrap with errors.Is) when no
// pending, unexpired invite matches — the caller decides what that means.
func (r *UserRepository) GetUserByInviteToken(ctx context.Context, token string) (*model.User, error) {
	row, err := r.q.GetUserByInviteToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("repository.GetUserByInviteToken: %w", err)
	}
	return toModel(row), nil
}

// ActivateUser performs the atomic, optimistic-concurrency UPDATE described
// in plan.md — it returns pgx.ErrNoRows when the token didn't match a
// pending, unexpired row (already consumed by a concurrent request, or
// simply invalid/expired). The service layer distinguishes those cases.
//
// A unique violation on the username index means another live account took
// that tên đăng nhập; the UPDATE is rolled back, so the invite stays usable.
func (r *UserRepository) ActivateUser(ctx context.Context, inviteToken, username string, fullName *string, passwordHash string) (*model.User, error) {
	row, err := r.q.ActivateUser(ctx, sqlc.ActivateUserParams{
		InviteToken:  inviteToken,
		FullName:     fullName,
		PasswordHash: passwordHash,
		Username:     username,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ActivateUser: %w", err)
	}
	return toModel(row), nil
}

// ResendInvite rotates the invite token of a still-pending user. It returns
// pgx.ErrNoRows when the user is no longer pending or a concurrent resend
// already moved invite_resend_count past expectedResendCount.
func (r *UserRepository) ResendInvite(ctx context.Context, id uuid.UUID, inviteToken string, expectedResendCount int32) (*model.User, error) {
	row, err := r.q.ResendInvite(ctx, sqlc.ResendInviteParams{
		ID:                id,
		InviteToken:       inviteToken,
		InviteResendCount: expectedResendCount,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ResendInvite: %w", err)
	}
	return toModel(row), nil
}

func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("repository.GetUserByEmail: %w", err)
	}
	return toModel(row), nil
}

func (r *UserRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	row, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetUserByID: %w", err)
	}
	return toModel(row), nil
}

// CountUserByEmailAnyStatus backs the invite duplicate-check (spec.md: "any
// status", not soft-delete aware — see migration 001_init.sql's partial
// unique index for why a soft-deleted user's email is intentionally excluded).
func (r *UserRepository) CountUserByEmailAnyStatus(ctx context.Context, email string) (int64, error) {
	count, err := r.q.CountUserByEmailAnyStatus(ctx, email)
	if err != nil {
		return 0, fmt.Errorf("repository.CountUserByEmailAnyStatus: %w", err)
	}
	return count, nil
}

func (r *UserRepository) ListUsers(ctx context.Context, p ListUsersParams) ([]*model.User, error) {
	rows, err := r.q.ListUsers(ctx, sqlc.ListUsersParams{
		Limit:           p.Limit,
		Status:          p.Status,
		Role:            p.Role,
		CursorCreatedAt: p.CursorCreatedAt,
		CursorID:        p.CursorID,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListUsers: %w", err)
	}
	users := make([]*model.User, 0, len(rows))
	for _, row := range rows {
		users = append(users, toModel(row))
	}
	return users, nil
}

func (r *UserRepository) CountUsers(ctx context.Context, status, role *string) (int64, error) {
	count, err := r.q.CountUsers(ctx, sqlc.CountUsersParams{Status: status, Role: role})
	if err != nil {
		return 0, fmt.Errorf("repository.CountUsers: %w", err)
	}
	return count, nil
}

// SetTokensValidAfter moves the user's sign-out-everywhere point. Returns
// false when no row matched (unknown or soft-deleted user).
func (r *UserRepository) SetTokensValidAfter(ctx context.Context, id uuid.UUID, at time.Time) (bool, error) {
	affected, err := r.q.SetUserTokensValidAfter(ctx, id, at)
	if err != nil {
		return false, fmt.Errorf("repository.SetTokensValidAfter: %w", err)
	}
	return affected > 0, nil
}

// UpdateFullName returns pgx.ErrNoRows (wrapped) for an unknown or
// soft-deleted user.
func (r *UserRepository) UpdateFullName(ctx context.Context, id uuid.UUID, fullName string) (*model.User, error) {
	row, err := r.q.UpdateUserFullName(ctx, id, fullName)
	if err != nil {
		return nil, fmt.Errorf("repository.UpdateFullName: %w", err)
	}
	return toModel(row), nil
}

// SetAvatarURL stores the avatar URL, or clears it when avatarURL is nil.
// Returns pgx.ErrNoRows (wrapped) for an unknown or soft-deleted user.
func (r *UserRepository) SetAvatarURL(ctx context.Context, id uuid.UUID, avatarURL *string) (*model.User, error) {
	row, err := r.q.SetUserAvatarURL(ctx, id, avatarURL)
	if err != nil {
		return nil, fmt.Errorf("repository.SetAvatarURL: %w", err)
	}
	return toModel(row), nil
}

func toModel(row sqlc.User) *model.User {
	return &model.User{
		ID:                row.ID,
		Email:             row.Email,
		FullName:          row.FullName,
		PasswordHash:      row.PasswordHash,
		Status:            model.UserStatus(row.Status),
		Role:              model.UserRole(row.Role),
		InvitedBy:         row.InvitedBy,
		InviteToken:       row.InviteToken,
		InviteExpiresAt:   row.InviteExpiresAt,
		ActivatedAt:       row.ActivatedAt,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
		DeletedAt:         row.DeletedAt,
		InviteSentAt:      row.InviteSentAt,
		InviteResendCount: row.InviteResendCount,
		TokensValidAfter:  row.TokensValidAfter,
		AvatarURL:         row.AvatarURL,
		Username:          row.Username,
	}
}
