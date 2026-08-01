package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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

// WalletRepo is the repository contract WalletService depends on (F-03).
// *repository.WalletRepository satisfies this structurally; tests substitute
// an in-memory fake, same convention as UserRepo.
type WalletRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	CreateWallet(ctx context.Context, tx pgx.Tx, arg repository.CreateWalletParams) (*model.Wallet, error)
	CountWalletsByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	ClearDefaultWallet(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error
	ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Wallet, error)
	GetWalletByID(ctx context.Context, id uuid.UUID) (*model.Wallet, error)
	UpdateWallet(ctx context.Context, arg repository.UpdateWalletParams) (*model.Wallet, error)
	SetDefaultWallet(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Wallet, error)
}

// CategoryRepo is the repository contract CategoryService depends on (F-04).
// *repository.CategoryRepository satisfies this structurally; tests
// substitute an in-memory fake, same convention as WalletRepo. No BeginTx
// method exists here — unlike WalletRepo, no operation in this feature needs
// a caller-managed transaction (plan.md Constitution Notes).
type CategoryRepo interface {
	CreateCategory(ctx context.Context, arg repository.CreateCategoryParams) (*model.Category, error)
	NameTypeExists(ctx context.Context, userID uuid.UUID, name, categoryType string, excludeID *uuid.UUID) (bool, error)
	ListCategoriesForUser(ctx context.Context, userID uuid.UUID, categoryType *string) ([]*model.Category, error)
	GetCategoryByID(ctx context.Context, id uuid.UUID) (*model.Category, error)
	UpdateCategory(ctx context.Context, arg repository.UpdateCategoryParams) (*model.Category, error)
	SoftDeleteCategory(ctx context.Context, id, userID uuid.UUID) (*model.Category, error)
}

// Compile-time checks that the real repositories satisfy these interfaces —
// catches a signature drift here instead of at runtime.
var (
	_ UserRepo         = (*repository.UserRepository)(nil)
	_ RevokedTokenRepo = (*repository.RevokedTokenRepository)(nil)
	_ WalletRepo       = (*repository.WalletRepository)(nil)
	_ CategoryRepo     = (*repository.CategoryRepository)(nil)
)
