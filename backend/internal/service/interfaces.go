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
// substitute an in-memory fake, same convention as WalletRepo. BeginTx/
// LockCategoryByID/HasActiveBudgetForCategory and the tx-scoped
// SoftDeleteCategory were added by specs/budget-management/plan.md
// Finding #2 / BUD-T15 — DeleteCategory now needs a transaction to close the
// create-vs-delete race with Budget creation and to back the 409
// CATEGORY_IN_USE check.
type CategoryRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	CreateCategory(ctx context.Context, arg repository.CreateCategoryParams) (*model.Category, error)
	NameTypeExists(ctx context.Context, userID uuid.UUID, name, categoryType string, excludeID *uuid.UUID) (bool, error)
	ListCategoriesForUser(ctx context.Context, userID uuid.UUID, categoryType *string) ([]*model.Category, error)
	GetCategoryByID(ctx context.Context, id uuid.UUID) (*model.Category, error)
	UpdateCategory(ctx context.Context, arg repository.UpdateCategoryParams) (*model.Category, error)
	SoftDeleteCategory(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Category, error)
	LockCategoryByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*model.Category, error)
	HasActiveBudgetForCategory(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (bool, error)
}

// BudgetRepo is the repository contract BudgetService depends on (F-05).
// *repository.BudgetRepository satisfies this structurally; tests
// substitute an in-memory fake, same convention as WalletRepo/CategoryRepo.
type BudgetRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	LockCategoryForBudgetCheck(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (*model.Category, error)
	CreateBudget(ctx context.Context, tx pgx.Tx, arg repository.CreateBudgetParams) (*model.Budget, error)
	ReplaceBudgetLimits(ctx context.Context, tx pgx.Tx, budgetID uuid.UUID, limits []model.BudgetLimit) error
	TouchBudgetUpdatedAt(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) error
	ListBudgetsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error)
	GetBudgetByID(ctx context.Context, id uuid.UUID) (*model.Budget, error)
	SoftDeleteBudget(ctx context.Context, id, userID uuid.UUID) (*model.Budget, error)
}

// Compile-time checks that the real repositories satisfy these interfaces —
// catches a signature drift here instead of at runtime.
var (
	_ UserRepo         = (*repository.UserRepository)(nil)
	_ RevokedTokenRepo = (*repository.RevokedTokenRepository)(nil)
	_ WalletRepo       = (*repository.WalletRepository)(nil)
	_ CategoryRepo     = (*repository.CategoryRepository)(nil)
	_ BudgetRepo       = (*repository.BudgetRepository)(nil)
)
