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
// WalletRepo interface. HasTransactionForWallet was added by
// specs/transaction-management/plan.md Finding #2 / WAL-T14 — backs the
// previously-deferred 409 CURRENCY_LOCKED check in UpdateWallet now that the
// transactions table exists.
type WalletRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	CreateWallet(ctx context.Context, tx pgx.Tx, arg repository.CreateWalletParams) (*model.Wallet, error)
	CountWalletsByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	ClearDefaultWallet(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error
	ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Wallet, error)
	GetWalletByID(ctx context.Context, id uuid.UUID) (*model.Wallet, error)
	UpdateWallet(ctx context.Context, arg repository.UpdateWalletParams) (*model.Wallet, error)
	SetDefaultWallet(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Wallet, error)
	HasTransactionForWallet(ctx context.Context, walletID uuid.UUID) (bool, error)
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
// SpentByUserCurrentPeriod was added by
// specs/transaction-management/plan.md Finding #3 / BUD-T17 — backs the
// previously-stubbed real spend computation now that the transactions table
// exists.
type BudgetRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	LockCategoryForBudgetCheck(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (*model.Category, error)
	CreateBudget(ctx context.Context, tx pgx.Tx, arg repository.CreateBudgetParams) (*model.Budget, error)
	ReplaceBudgetLimits(ctx context.Context, tx pgx.Tx, budgetID uuid.UUID, limits []model.BudgetLimit) error
	// UpdateBudgetFields superseded TouchBudgetUpdatedAt
	// (specs/wallet-budget-icons/plan.md Finding #1) — every Update now needs
	// an updated_at bump regardless of which fields changed, and this also
	// applies icon/icon_url.
	UpdateBudgetFields(ctx context.Context, tx pgx.Tx, arg repository.UpdateBudgetFieldsParams) (*model.Budget, error)
	ListBudgetsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error)
	GetBudgetByID(ctx context.Context, id uuid.UUID) (*model.Budget, error)
	SoftDeleteBudget(ctx context.Context, id, userID uuid.UUID) (*model.Budget, error)
	SpentByUserCurrentPeriod(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]map[string]int64, error)
	// ListDistinctUserIDsWithActiveBudgets was added by
	// specs/notification-handling/plan.md Finding #1 — backs
	// NotificationService.EvaluateBudgets, which loops this list and reuses
	// this repo's own per-user methods above rather than a new global query.
	ListDistinctUserIDsWithActiveBudgets(ctx context.Context) ([]uuid.UUID, error)
}

// TransactionRepo is the repository contract TransactionService depends on
// (F-06). *repository.TransactionRepository satisfies this structurally;
// tests substitute an in-memory fake, same convention as WalletRepo/
// CategoryRepo/BudgetRepo. GetTransactionByIdempotencyKey was added by
// specs/ai-chat-assistant/plan.md Finding #3 — backs the idempotency replay
// check on CreateTransaction now that the column exists.
type TransactionRepo interface {
	BeginTx(ctx context.Context) (pgx.Tx, error)
	CreateTransaction(ctx context.Context, tx pgx.Tx, arg repository.CreateTransactionParams) (*model.Transaction, error)
	GetTransactionByIdempotencyKey(ctx context.Context, userID, idempotencyKey uuid.UUID) (*model.Transaction, error)
	DecrementWalletBalanceIfSufficient(ctx context.Context, tx pgx.Tx, walletID uuid.UUID, amount int64) (*model.Wallet, error)
	AdjustWalletBalance(ctx context.Context, tx pgx.Tx, walletID uuid.UUID, delta int64) (*model.Wallet, error)
	ListTransactionsByUser(ctx context.Context, userID uuid.UUID, filter repository.ListTransactionsFilter) ([]*model.Transaction, error)
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*model.Transaction, error)
	UpdateTransaction(ctx context.Context, tx pgx.Tx, arg repository.UpdateTransactionParams) (*model.Transaction, error)
	SoftDeleteTransaction(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Transaction, error)
}

// ChatRepo is the repository contract ChatService depends on (Feature-12 AI
// Chat Assistant). *repository.ChatRepository satisfies this structurally;
// tests substitute an in-memory fake, same convention as every other repo.
type ChatRepo interface {
	CreateChatMessage(ctx context.Context, arg repository.CreateChatMessageParams) (*model.ChatMessage, error)
}

// AIServiceClient is the contract ChatService depends on for talking to the
// Python AI Service (specs/ai-chat-assistant/plan.md AI-T10). A real HTTP
// implementation lives in ai_service_client.go; tests substitute a fake.
type AIServiceClient interface {
	Extract(ctx context.Context, req AIExtractRequest) (*AIExtractResponse, error)
}

// ReportRepo is the repository contract ReportService depends on (F-07).
// *repository.ReportRepository satisfies this structurally; tests substitute
// an in-memory fake, same convention as WalletRepo/CategoryRepo/BudgetRepo/
// TransactionRepo. Both methods run queries declared in transactions.sql
// (cross-repository query exception, specs/financial-reporting/plan.md
// Security & Actor Resolution — the same exception F-05's
// SpentByUserCurrentPeriod already uses).
type ReportRepo interface {
	SumTotals(ctx context.Context, userID uuid.UUID, filter repository.ReportFilter) ([]model.ReportTypeAmount, error)
	SumByCategory(ctx context.Context, userID uuid.UUID, filter repository.ReportFilter) ([]model.ReportCategoryEntry, error)
}

// NotificationRepo is the repository contract NotificationService depends on
// (F-10). *repository.NotificationRepository satisfies this structurally;
// tests substitute an in-memory fake, same convention as WalletRepo/
// CategoryRepo/BudgetRepo/TransactionRepo/ReportRepo.
type NotificationRepo interface {
	CreateBudgetExceededNotification(ctx context.Context, arg repository.CreateBudgetExceededNotificationParams) (bool, error)
	ListNotificationsByUser(ctx context.Context, userID uuid.UUID, filter repository.ListNotificationsFilter) ([]*model.Notification, error)
	CountNotifications(ctx context.Context, userID uuid.UUID, isRead *bool) (int64, error)
	GetNotificationByID(ctx context.Context, id uuid.UUID) (*model.Notification, error)
	MarkNotificationRead(ctx context.Context, id, userID uuid.UUID) (*model.Notification, error)
}

// Compile-time checks that the real repositories satisfy these interfaces —
// catches a signature drift here instead of at runtime.
var (
	_ UserRepo         = (*repository.UserRepository)(nil)
	_ RevokedTokenRepo = (*repository.RevokedTokenRepository)(nil)
	_ WalletRepo       = (*repository.WalletRepository)(nil)
	_ CategoryRepo     = (*repository.CategoryRepository)(nil)
	_ BudgetRepo       = (*repository.BudgetRepository)(nil)
	_ TransactionRepo  = (*repository.TransactionRepository)(nil)
	_ ReportRepo       = (*repository.ReportRepository)(nil)
	_ NotificationRepo = (*repository.NotificationRepository)(nil)
	_ ChatRepo         = (*repository.ChatRepository)(nil)
)
