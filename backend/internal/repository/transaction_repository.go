package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// TransactionRepository wraps the sqlc-generated transaction queries and
// returns domain models, never sqlc's raw row structs. No business rules
// live here — Wallet/Category ownership, type-match, and the
// conditional-vs-unconditional balance mutation choice are all decided by
// TransactionService. Runs the two wallets-table balance-mutation queries
// via the shared *sqlc.Queries struct (cross-repository query exception,
// specs/transaction-management/plan.md Security & Actor Resolution — the
// mirror image of WalletRepository/BudgetRepository each querying
// transactions).
type TransactionRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewTransactionRepository(q *sqlc.Queries, pool Beginner) *TransactionRepository {
	return &TransactionRepository{q: q, pool: pool}
}

// BeginTx starts a transaction the caller (TransactionService) commits or
// rolls back — Create/Update/Delete all need one (CLAUDE.md: wallet balance
// update and transaction insert/mutation always in the same DB transaction).
func (r *TransactionRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}

type CreateTransactionParams struct {
	UserID     uuid.UUID
	WalletID   uuid.UUID
	CategoryID uuid.UUID
	Amount     int64
	Type       string
	Note       *string
	OccurredAt time.Time
}

func (r *TransactionRepository) CreateTransaction(ctx context.Context, tx pgx.Tx, arg CreateTransactionParams) (*model.Transaction, error) {
	row, err := r.q.WithTx(tx).CreateTransaction(ctx, sqlc.CreateTransactionParams{
		UserID:     arg.UserID,
		WalletID:   arg.WalletID,
		CategoryID: arg.CategoryID,
		Amount:     arg.Amount,
		Type:       arg.Type,
		Note:       arg.Note,
		OccurredAt: arg.OccurredAt,
	})
	if err != nil {
		return nil, err
	}
	return toTransactionModel(row), nil
}

// DecrementWalletBalanceIfSufficient backs the insufficient-balance floor for
// expense Transaction creation (spec.md Context #4) — returns pgx.ErrNoRows
// when the wallet's balance is insufficient, the authoritative signal for
// 409 INSUFFICIENT_BALANCE. Never used for Update/Delete — see
// AdjustWalletBalance.
func (r *TransactionRepository) DecrementWalletBalanceIfSufficient(ctx context.Context, tx pgx.Tx, walletID uuid.UUID, amount int64) (*model.Wallet, error) {
	row, err := r.q.WithTx(tx).DecrementWalletBalanceIfSufficient(ctx, sqlc.DecrementWalletBalanceIfSufficientParams{
		ID:     walletID,
		Amount: amount,
	})
	if err != nil {
		return nil, err
	}
	return toWalletModel(row), nil
}

// AdjustWalletBalance is the unconditional, floor-free signed-delta balance
// mutation (spec.md Context #3) — used for income Transaction creation
// (positive delta) and every Update/Delete balance reconciliation (positive
// or negative delta). The resulting balance may land at zero or below.
func (r *TransactionRepository) AdjustWalletBalance(ctx context.Context, tx pgx.Tx, walletID uuid.UUID, delta int64) (*model.Wallet, error) {
	row, err := r.q.WithTx(tx).AdjustWalletBalance(ctx, sqlc.AdjustWalletBalanceParams{
		ID:    walletID,
		Delta: delta,
	})
	if err != nil {
		return nil, err
	}
	return toWalletModel(row), nil
}

// GetTransactionByID returns pgx.ErrNoRows (unwrap with errors.Is) when no
// non-deleted transaction matches — it is NOT scoped by user_id; the service
// layer decides visibility/403/404.
func (r *TransactionRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*model.Transaction, error) {
	row, err := r.q.GetTransactionByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &model.Transaction{
		ID:           row.ID,
		UserID:       row.UserID,
		WalletID:     row.WalletID,
		WalletName:   row.WalletName,
		CategoryID:   row.CategoryID,
		CategoryName: row.CategoryName,
		Amount:       row.Amount,
		Type:         model.TransactionType(row.Type),
		Note:         row.Note,
		OccurredAt:   row.OccurredAt,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
		DeletedAt:    row.DeletedAt,
	}, nil
}

// ListTransactionsFilter carries US-02's optional query filters — every
// pointer field left nil is a no-op AND clause at the SQL layer.
type ListTransactionsFilter struct {
	WalletID         *uuid.UUID
	CategoryID       *uuid.UUID
	Type             *string
	From             *time.Time
	To               *time.Time
	CursorOccurredAt *time.Time
	CursorID         *uuid.UUID
	Limit            int32
}

// ListTransactionsByUser is cursor-paginated on occurred_at, not created_at
// (spec.md Edge Cases US-02 #1) — see service/cursor.go's
// encodeTransactionCursor/decodeTransactionCursor pair.
func (r *TransactionRepository) ListTransactionsByUser(ctx context.Context, userID uuid.UUID, filter ListTransactionsFilter) ([]*model.Transaction, error) {
	rows, err := r.q.ListTransactionsByUser(ctx, sqlc.ListTransactionsByUserParams{
		UserID:           userID,
		Limit:            filter.Limit,
		WalletID:         filter.WalletID,
		CategoryID:       filter.CategoryID,
		Type:             filter.Type,
		FromTs:           filter.From,
		ToTs:             filter.To,
		CursorOccurredAt: filter.CursorOccurredAt,
		CursorID:         filter.CursorID,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListTransactionsByUser: %w", err)
	}
	transactions := make([]*model.Transaction, 0, len(rows))
	for _, row := range rows {
		transactions = append(transactions, &model.Transaction{
			ID:           row.ID,
			UserID:       row.UserID,
			WalletID:     row.WalletID,
			WalletName:   row.WalletName,
			CategoryID:   row.CategoryID,
			CategoryName: row.CategoryName,
			Amount:       row.Amount,
			Type:         model.TransactionType(row.Type),
			Note:         row.Note,
			OccurredAt:   row.OccurredAt,
			CreatedAt:    row.CreatedAt,
			UpdatedAt:    row.UpdatedAt,
			DeletedAt:    row.DeletedAt,
		})
	}
	return transactions, nil
}

type UpdateTransactionParams struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Amount     *int64
	CategoryID *uuid.UUID
	OccurredAt *time.Time
	Note       *string
}

// UpdateTransaction is scoped by id + user_id, same visibility guarantee as
// UpdateWallet/UpdateCategory. Runs inside the caller's transaction (always,
// per plan.md Finding #13) alongside any AdjustWalletBalance call.
func (r *TransactionRepository) UpdateTransaction(ctx context.Context, tx pgx.Tx, arg UpdateTransactionParams) (*model.Transaction, error) {
	row, err := r.q.WithTx(tx).UpdateTransaction(ctx, sqlc.UpdateTransactionParams{
		ID:         arg.ID,
		UserID:     arg.UserID,
		Amount:     arg.Amount,
		CategoryID: arg.CategoryID,
		OccurredAt: arg.OccurredAt,
		Note:       arg.Note,
	})
	if err != nil {
		return nil, err
	}
	return toTransactionModel(row), nil
}

// SoftDeleteTransaction is scoped by id + user_id, same visibility guarantee
// as SoftDeleteBudget. Runs inside the caller's transaction alongside the
// AdjustWalletBalance reversal call.
func (r *TransactionRepository) SoftDeleteTransaction(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Transaction, error) {
	row, err := r.q.WithTx(tx).SoftDeleteTransaction(ctx, sqlc.SoftDeleteTransactionParams{ID: id, UserID: userID})
	if err != nil {
		return nil, err
	}
	return toTransactionModel(row), nil
}

func toTransactionModel(row sqlc.Transaction) *model.Transaction {
	return &model.Transaction{
		ID:         row.ID,
		UserID:     row.UserID,
		WalletID:   row.WalletID,
		CategoryID: row.CategoryID,
		Amount:     row.Amount,
		Type:       model.TransactionType(row.Type),
		Note:       row.Note,
		OccurredAt: row.OccurredAt,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		DeletedAt:  row.DeletedAt,
	}
}

// toWalletModel already exists in wallet_repository.go (same package) —
// reused here for DecrementWalletBalanceIfSufficient/AdjustWalletBalance's
// sqlc.Wallet -> model.Wallet conversion, not redefined.
