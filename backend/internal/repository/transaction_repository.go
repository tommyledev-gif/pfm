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
	// IdempotencyKey is nil for every manual create (existing behavior,
	// unchanged) and non-nil only for the AI Chat confirm flow
	// (specs/ai-chat-assistant/plan.md Finding #3).
	IdempotencyKey *uuid.UUID
	// ToWalletID is the destination Wallet, set only for a transfer.
	ToWalletID *uuid.UUID
	// Location is nil for a Transaction recorded without a map pin.
	Location *model.TransactionLocation
}

func (r *TransactionRepository) CreateTransaction(ctx context.Context, tx pgx.Tx, arg CreateTransactionParams) (*model.Transaction, error) {
	params := sqlc.CreateTransactionParams{
		UserID:         arg.UserID,
		WalletID:       arg.WalletID,
		CategoryID:     arg.CategoryID,
		Amount:         arg.Amount,
		Type:           arg.Type,
		Note:           arg.Note,
		OccurredAt:     arg.OccurredAt,
		IdempotencyKey: arg.IdempotencyKey,
		ToWalletID:     arg.ToWalletID,
	}
	if loc := arg.Location; loc != nil {
		params.LocationLat = &loc.Latitude
		params.LocationLng = &loc.Longitude
		params.LocationName = loc.PlaceName
		params.LocationNote = loc.Note
	}
	row, err := r.q.WithTx(tx).CreateTransaction(ctx, params)
	if err != nil {
		return nil, err
	}
	return toTransactionModel(row), nil
}

// GetTransactionByIdempotencyKey backs the AI Chat confirm-step replay check
// (specs/ai-chat-assistant/spec.md Resolved design decision #5, S-AI-13) —
// returns pgx.ErrNoRows when no Transaction matches (user_id, idempotency_key),
// the signal that the key is fresh. Soft-deleted rows DO match (BR-OFF-B01):
// a used key never becomes fresh again.
func (r *TransactionRepository) GetTransactionByIdempotencyKey(ctx context.Context, userID, idempotencyKey uuid.UUID) (*model.Transaction, error) {
	row, err := r.q.GetTransactionByIdempotencyKey(ctx, userID, idempotencyKey)
	if err != nil {
		return nil, err
	}
	return toJoinedTransactionModel(sqlc.GetTransactionByIDRow(row)), nil
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
	return toJoinedTransactionModel(row), nil
}

// ListTransactionsFilter carries US-02's optional query filters — every
// pointer field left nil (and CategoryIDs left nil/empty) is a no-op AND
// clause at the SQL layer.
type ListTransactionsFilter struct {
	WalletID         *uuid.UUID
	CategoryID       *uuid.UUID
	CategoryIDs      []uuid.UUID
	Type             *string
	From             *time.Time
	To               *time.Time
	Search           *string
	CursorOccurredAt *time.Time
	CursorCreatedAt  *time.Time
	CursorID         *uuid.UUID
	Limit            int32
}

// ListTransactionsByUser is cursor-paginated on (occurred_at, created_at, id)
// (spec.md Edge Cases US-02 #1, plus a created_at tie-break for same-day
// transactions) — see service/cursor.go's encodeTransactionCursor/
// decodeTransactionCursor pair.
func (r *TransactionRepository) ListTransactionsByUser(ctx context.Context, userID uuid.UUID, filter ListTransactionsFilter) ([]*model.Transaction, error) {
	rows, err := r.q.ListTransactionsByUser(ctx, sqlc.ListTransactionsByUserParams{
		UserID:           userID,
		Limit:            filter.Limit,
		WalletID:         filter.WalletID,
		CategoryID:       filter.CategoryID,
		CategoryIDs:      filter.CategoryIDs,
		Type:             filter.Type,
		FromTs:           filter.From,
		ToTs:             filter.To,
		Search:           filter.Search,
		CursorOccurredAt: filter.CursorOccurredAt,
		CursorCreatedAt:  filter.CursorCreatedAt,
		CursorID:         filter.CursorID,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.ListTransactionsByUser: %w", err)
	}
	transactions := make([]*model.Transaction, 0, len(rows))
	for _, row := range rows {
		transactions = append(transactions, toJoinedTransactionModel(sqlc.GetTransactionByIDRow(row)))
	}
	return transactions, nil
}

// CountTransactionsByUser returns how many rows match `filter` in total,
// ignoring its cursor/limit fields — those describe one page, not the result
// set. Called alongside ListTransactionsByUser for the first page only (see
// TransactionService.ListTransactions).
func (r *TransactionRepository) CountTransactionsByUser(ctx context.Context, userID uuid.UUID, filter ListTransactionsFilter) (int64, error) {
	total, err := r.q.CountTransactionsByUser(ctx, sqlc.CountTransactionsByUserParams{
		UserID:      userID,
		WalletID:    filter.WalletID,
		CategoryID:  filter.CategoryID,
		CategoryIDs: filter.CategoryIDs,
		Type:        filter.Type,
		FromTs:      filter.From,
		ToTs:        filter.To,
		Search:      filter.Search,
	})
	if err != nil {
		return 0, fmt.Errorf("repository.CountTransactionsByUser: %w", err)
	}
	return total, nil
}

type UpdateTransactionParams struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Amount     *int64
	CategoryID *uuid.UUID
	OccurredAt *time.Time
	Note       *string
	// LocationNote: nil leaves it unchanged, "" clears it, anything else sets
	// it.
	LocationNote *string
	// LocationLat/LocationLng move an existing pin: nil (both) leaves it
	// unchanged, non-nil (always both — the service guarantees the pair)
	// moves it. LocationName is the new position's place name, written only
	// alongside a move; nil or "" stores NULL.
	LocationLat  *float64
	LocationLng  *float64
	LocationName *string
}

// UpdateTransaction is scoped by id + user_id, same visibility guarantee as
// UpdateWallet/UpdateCategory. Runs inside the caller's transaction (always,
// per plan.md Finding #13) alongside any AdjustWalletBalance call.
func (r *TransactionRepository) UpdateTransaction(ctx context.Context, tx pgx.Tx, arg UpdateTransactionParams) (*model.Transaction, error) {
	row, err := r.q.WithTx(tx).UpdateTransaction(ctx, sqlc.UpdateTransactionParams{
		ID:           arg.ID,
		UserID:       arg.UserID,
		Amount:       arg.Amount,
		CategoryID:   arg.CategoryID,
		OccurredAt:   arg.OccurredAt,
		Note:         arg.Note,
		LocationNote: arg.LocationNote,
		LocationLat:  arg.LocationLat,
		LocationLng:  arg.LocationLng,
		LocationName: arg.LocationName,
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

// toTransactionModel, toJoinedTransactionModel and toTransactionLocation live
// in transaction_repository_mapping.go (300-line cap). toWalletModel already
// exists in wallet_repository.go (same package) — reused here for
// DecrementWalletBalanceIfSufficient/AdjustWalletBalance's sqlc.Wallet ->
// model.Wallet conversion, not redefined.
