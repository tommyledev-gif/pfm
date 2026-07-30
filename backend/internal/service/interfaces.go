package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// UserRepo is the repository contract UserService/AuthService depend on.
// *repository.UserRepository satisfies this structurally; tests substitute
// an in-memory fake — Go Test Conventions require mocking the repository
// interface, not hitting a real database, for service-layer unit tests.
type UserRepo interface {
	CreatePendingUser(ctx context.Context, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error)
	GetUserByInviteToken(ctx context.Context, token string) (*model.User, error)
	ActivateUser(ctx context.Context, inviteToken string, fullName *string, passwordHash string) (*model.User, error)
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	CountUserByEmailAnyStatus(ctx context.Context, email string) (int64, error)
	ListUsers(ctx context.Context, p repository.ListUsersParams) ([]*model.User, error)
	CountUsers(ctx context.Context, status, role *string) (int64, error)
}

// RevokedTokenRepo is the repository contract AuthService.Logout depends on.
type RevokedTokenRepo interface {
	Revoke(ctx context.Context, tokenJTI string, userID *uuid.UUID, expiresAt time.Time) error
	IsRevoked(ctx context.Context, tokenJTI string) (bool, error)
}

// Compile-time checks that the real repositories satisfy these interfaces —
// catches a signature drift here instead of at runtime.
var (
	_ UserRepo         = (*repository.UserRepository)(nil)
	_ RevokedTokenRepo = (*repository.RevokedTokenRepository)(nil)
)
