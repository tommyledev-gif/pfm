package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// RevokedTokenRepo is the repository contract AuthService.Logout depends on.
type RevokedTokenRepo interface {
	Revoke(ctx context.Context, tokenJTI string, userID *uuid.UUID, expiresAt time.Time) error
	IsRevoked(ctx context.Context, tokenJTI string) (bool, error)
	Claim(ctx context.Context, tokenJTI string, userID *uuid.UUID, expiresAt time.Time) (bool, error)
	// Release undoes a Claim whose redemption then failed.
	Release(ctx context.Context, tokenJTI string) error
}

// SessionRepo is the repository contract SessionService depends on (mig 028).
// *repository.SessionRepository satisfies it structurally; tests substitute
// an in-memory fake.
type SessionRepo interface {
	// Create revokes the user's least recently used live sessions so that,
	// with the new one, at most maxActive remain, then inserts it.
	Create(ctx context.Context, s model.Session, maxActive int) error
	Get(ctx context.Context, id uuid.UUID) (*model.Session, error)
	// Rotate is a compare-and-swap on the current refresh jti.
	Rotate(ctx context.Context, id uuid.UUID, currentJTI, newJTI string, expiresAt time.Time) (bool, error)
	Revoke(ctx context.Context, id, userID uuid.UUID, reason string) (bool, error)
	RevokeAllForUser(ctx context.Context, userID uuid.UUID, reason string) (int64, error)
	// AuthState returns nil, nil when there is no such session for the user.
	AuthState(ctx context.Context, id, userID uuid.UUID) (*model.SessionAuthState, error)
	DeleteExpired(ctx context.Context, cutoff time.Time) (int64, error)
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
	// GetCategoriesByIDs is GetCategoryByID for a list, in one query; ids with
	// no live Category are left out of the result.
	GetCategoriesByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.Category, error)
	// GetSystemCategoryByKey resolves the transfer Category (and any future
	// server-assigned system Category) by its stable system_key.
	GetSystemCategoryByKey(ctx context.Context, systemKey string) (*model.Category, error)
	UpdateCategory(ctx context.Context, arg repository.UpdateCategoryParams) (*model.Category, error)
	SoftDeleteCategory(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Category, error)
	LockCategoryByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*model.Category, error)
	HasActiveBudgetForCategory(ctx context.Context, tx pgx.Tx, categoryID uuid.UUID) (bool, error)
}

// BudgetRepo is the repository contract BudgetService depends on (F-05).
// *repository.BudgetRepository satisfies this structurally; tests
// substitute an in-memory fake, same convention as WalletRepo/CategoryRepo.
// SpentByUserInWindow (originally SpentByUserCurrentPeriod, added by
// specs/transaction-management/plan.md Finding #3 / BUD-T17) takes the
// half-open cycle window from CycleResolver since
// specs/ai-budget-wizard-v2 US-03.
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
	SpentByUserInWindow(ctx context.Context, userID uuid.UUID, from, to time.Time) (map[uuid.UUID]map[string]int64, error)
	// ListDistinctUserIDsWithActiveBudgets was added by
	// specs/notification-handling/plan.md Finding #1 — backs
	// NotificationService.EvaluateBudgets, which loops this list and reuses
	// this repo's own per-user methods above rather than a new global query.
	ListDistinctUserIDsWithActiveBudgets(ctx context.Context) ([]uuid.UUID, error)
	// LockBudgetsByUser/SoftDeleteBudgetsByUser/DeleteBudgetLimitsByBudgetIDs
	// were added by specs/ai-budget-wizard/plan.md Finding #5/#10 — back
	// BudgetService.BulkReplaceBudgets's atomic full-replace (F-13).
	// LockUserForBudgetReplace closes the first-submit race
	// (docs/new-tasks.md I-4): LockBudgetsByUser locks nothing for a User
	// with no Budgets yet.
	LockUserForBudgetReplace(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error
	LockBudgetsByUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) ([]*model.Budget, error)
	SoftDeleteBudgetsByUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error
	DeleteBudgetLimitsByBudgetIDs(ctx context.Context, tx pgx.Tx, budgetIDs []uuid.UUID) error
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
	CountTransactionsByUser(ctx context.Context, userID uuid.UUID, filter repository.ListTransactionsFilter) (int64, error)
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*model.Transaction, error)
	// GetTransactionOwnerIncludingDeleted ignores deleted_at on purpose — it
	// authorizes reading a removed Transaction's audit history.
	GetTransactionOwnerIncludingDeleted(ctx context.Context, id uuid.UUID) (uuid.UUID, error)
	UpdateTransaction(ctx context.Context, tx pgx.Tx, arg repository.UpdateTransactionParams) (*model.Transaction, error)
	SoftDeleteTransaction(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Transaction, error)
	// InsertAuditLog was added by specs/transaction-audit-log/plan.md — it
	// lives on this interface, not on AuditLogRepo below, because it is only
	// ever called from inside TransactionService's own already-open pgx.Tx
	// (the same one carrying the balance mutation and the row write).
	InsertAuditLog(ctx context.Context, tx pgx.Tx, arg repository.InsertAuditLogParams) error
	// Items and Adjustments (specs/transaction-line-items). Writes run inside
	// the caller's tx; ListActiveLines takes a nil tx for a plain read.
	InsertTransactionLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID, lines repository.TransactionLines) error
	ListActiveLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) (repository.TransactionLines, error)
	ListActiveLinesByTransactionIDs(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) (map[uuid.UUID]repository.TransactionLines, error)
	SoftDeleteActiveLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) error
	CountActiveItems(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) (map[uuid.UUID]int, error)
	LockTransactionForUpdate(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) (repository.LockedTransaction, error)
}

// AuditLogRepo is the read-side repository contract AuditLogService depends
// on (specs/transaction-audit-log/spec.md US-02). Append-only by
// construction: there is deliberately no update/delete method here.
// *repository.AuditLogRepository satisfies this structurally.
type AuditLogRepo interface {
	ListAuditLogsByUser(ctx context.Context, userID uuid.UUID, filter repository.ListAuditLogsFilter) ([]*model.AuditLog, error)
	CountAuditLogs(ctx context.Context, userID uuid.UUID, transactionID *uuid.UUID) (int64, error)
}

// ChatRepo is the repository contract ChatService depends on (Feature-12 AI
// Chat Assistant). *repository.ChatRepository satisfies this structurally;
// tests substitute an in-memory fake, same convention as every other repo.
// ListRecentMessagesByConversation backs the AI Service conversation-history
// context added so a follow-up message can be disambiguated using what was
// already said in the same conversation, instead of being judged in
// isolation.
type ChatRepo interface {
	CreateChatMessage(ctx context.Context, arg repository.CreateChatMessageParams) (*model.ChatMessage, error)
	ListRecentMessagesByConversation(ctx context.Context, userID, conversationID uuid.UUID, limit int32) ([]*model.ChatMessage, error)
}

// ChatThreadRepo is the repository contract ChatThreadService depends on —
// the client-rendered chat UI cache (chat_thread_messages), distinct from
// ChatRepo's chat_messages (raw AI-context log only, never read back by a
// client). *repository.ChatThreadRepository satisfies this structurally.
type ChatThreadRepo interface {
	UpsertMessage(ctx context.Context, arg repository.UpsertChatThreadMessageParams) error
	ListByUser(ctx context.Context, userID uuid.UUID) ([]repository.ChatThreadRow, error)
}

// AIServiceClient is the contract ChatService depends on for talking to the
// Python AI Service (specs/ai-chat-assistant/plan.md AI-T10). A real HTTP
// implementation lives in ai_service_client.go; tests substitute a fake.
type AIServiceClient interface {
	Extract(ctx context.Context, req AIExtractRequest) (*AIExtractResponse, error)
}

// AIBudgetClient is the contract BudgetWizardService depends on for the one
// AI-Service-backed call this feature makes — SuggestCategoryName only
// (specs/ai-budget-wizard/plan.md Finding #6). The allocation-proposal math
// itself never leaves the Go Backend, so it has no place in this interface.
// A real HTTP implementation lives in ai_budget_client.go; tests substitute
// a fake.
type AIBudgetClient interface {
	SuggestCategoryName(ctx context.Context, description string) (*AISuggestCategoryNameResponse, error)
}

// ReportRepo is the repository contract ReportService depends on (F-07).
// *repository.ReportRepository satisfies this structurally; tests substitute
// an in-memory fake, same convention as WalletRepo/CategoryRepo/BudgetRepo/
// TransactionRepo. Both methods run queries declared in transactions.sql
// (cross-repository query exception, specs/financial-reporting/plan.md
// Security & Actor Resolution — the same exception F-05's
// SpentByUserInWindow already uses).
type ReportRepo interface {
	SumTotals(ctx context.Context, userID uuid.UUID, filter repository.ReportFilter) ([]model.ReportTypeAmount, error)
	SumByCategory(ctx context.Context, userID uuid.UUID, filter repository.ReportFilter) ([]model.ReportCategoryEntry, error)
}

// CyclePlanRepo is the one read CycleResolver needs from the plan layer
// (specs/ai-budget-wizard-v2 US-03). Returns 0 when the User has no plan.
type CyclePlanRepo interface {
	ActiveCycleStartDay(ctx context.Context, userID uuid.UUID) (int, error)
}

// AnalyticsRepo backs AnalyticsService's aggregates the report queries cannot
// answer (specs/ai-chat-query-spending/plan.md AIQ-T14).
type AnalyticsRepo interface {
	ListExpensesByAmount(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error)
	CountTransactions(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter) (int64, error)
	SumExpenseByWallet(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter) ([]model.AnalyticsKeyedAmount, error)
	SumExpenseByLocalDay(ctx context.Context, userID uuid.UUID, f repository.AnalyticsFilter, tz string) ([]model.AnalyticsDayAmount, error)
	ListTopCategoriesRecent(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]model.CategoryUsage, error)
}

// IntentParseLogRepo is the free-text question log (spec.md US-07).
type IntentParseLogRepo interface {
	Insert(ctx context.Context, entry model.IntentParseLog) error
	ClearRawTextBefore(ctx context.Context, cutoff time.Time) (int64, error)
	DeleteBefore(ctx context.Context, cutoff time.Time) (int64, error)
}

// AIConsultClient interprets one free-text spending question
// (specs/ai-chat-query-spending/plan.md AIQ-T34).
type AIConsultClient interface {
	Parse(ctx context.Context, req AIConsultRequest) (*AIConsultParse, error)
}

// BudgetStatusReader is the one BudgetService read analytics reuses, so a
// remaining-budget answer is computed by the exact code behind the Budgets
// screen (specs/ai-chat-query-spending/plan.md BR-06).
type BudgetStatusReader interface {
	ListBudgets(ctx context.Context, userID uuid.UUID) ([]*model.Budget, error)
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
	_ RevokedTokenRepo   = (*repository.RevokedTokenRepository)(nil)
	_ SessionRepo        = (*repository.SessionRepository)(nil)
	_ WalletRepo         = (*repository.WalletRepository)(nil)
	_ CategoryRepo       = (*repository.CategoryRepository)(nil)
	_ BudgetRepo         = (*repository.BudgetRepository)(nil)
	_ CyclePlanRepo      = (*repository.BudgetPlanRepository)(nil)
	_ AnalyticsRepo      = (*repository.AnalyticsRepository)(nil)
	_ IntentParseLogRepo = (*repository.IntentParseLogRepository)(nil)
	_ BudgetStatusReader = (*BudgetService)(nil)
	_ TransactionRepo    = (*repository.TransactionRepository)(nil)
	_ AuditLogRepo       = (*repository.AuditLogRepository)(nil)
	_ ReportRepo         = (*repository.ReportRepository)(nil)
	_ NotificationRepo   = (*repository.NotificationRepository)(nil)
	_ ChatRepo           = (*repository.ChatRepository)(nil)
	_ AIBudgetClient     = (*httpAIBudgetClient)(nil)
)
