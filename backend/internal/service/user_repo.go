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
	ActivateUser(ctx context.Context, inviteToken, username string, fullName *string, passwordHash string) (*model.User, error)
	ResendInvite(ctx context.Context, id uuid.UUID, inviteToken string, expectedResendCount int32) (*model.User, error)
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	CountUserByEmailAnyStatus(ctx context.Context, email string) (int64, error)
	ListUsers(ctx context.Context, p repository.ListUsersParams) ([]*model.User, error)
	CountUsers(ctx context.Context, status, role *string) (int64, error)
	SetTokensValidAfter(ctx context.Context, id uuid.UUID, at time.Time) (bool, error)
	// ChangePassword stores a new hash and moves tokens_valid_after in one
	// statement (false = unknown, deleted or inactive user).
	ChangePassword(ctx context.Context, id uuid.UUID, passwordHash string, signOutAt time.Time) (bool, error)
	UpdateFullName(ctx context.Context, id uuid.UUID, fullName string) (*model.User, error)
	SetAvatarURL(ctx context.Context, id uuid.UUID, avatarURL *string) (*model.User, error)
	// Tên đăng nhập (mig 030) and access requests (mig 031).
	GetUserByUsername(ctx context.Context, username string) (*model.User, error)
	SetUsernameOnce(ctx context.Context, id uuid.UUID, username string) (*model.User, error)
	CreateAccessRequest(ctx context.Context, email string, adminID uuid.UUID, approvalToken string) (*model.User, error)
	GetUserByApprovalToken(ctx context.Context, approvalToken string) (*model.User, error)
	ApproveAccessRequest(ctx context.Context, id uuid.UUID, inviteToken string) (*model.User, error)
	RejectAccessRequest(ctx context.Context, id uuid.UUID) (*model.User, error)
}

// Compile-time check, same as the ones in interfaces.go.
var _ UserRepo = (*repository.UserRepository)(nil)
