package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Beginner is satisfied by *pgxpool.Pool. WalletRepository exposes it as
// BeginTx so WalletService can own the pgx.Tx lifecycle (dev.md: "Service
// owns DB transactions") for the default-swap operations (US-01, US-05) —
// the repository only provides the mechanism, never decides when to use it.
type Beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// WalletRepository wraps the sqlc-generated wallet queries and returns
// domain models, never sqlc's raw row structs. No business rules live here
// — default-forcing, ownership checks, and race retries are all decided by
// WalletService.
type WalletRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewWalletRepository(q *sqlc.Queries, pool Beginner) *WalletRepository {
	return &WalletRepository{q: q, pool: pool}
}

// BeginTx starts a transaction the caller (WalletService) commits or rolls
// back — see WAL-T7/WAL-T10 in plan.md for why Create/SetDefault need one.
func (r *WalletRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}

type CreateWalletParams struct {
	UserID    uuid.UUID
	Name      string
	Type      string
	Balance   int64
	Currency  string
	IsDefault bool
	Icon      *string
	IconURL   *string
}

// CreateWallet always runs inside the caller's transaction — even the
// non-default path — so every write to this table goes through the same
// code path (simpler to reason about than branching on whether a tx exists).
func (r *WalletRepository) CreateWallet(ctx context.Context, tx pgx.Tx, arg CreateWalletParams) (*model.Wallet, error) {
	row, err := r.q.WithTx(tx).CreateWallet(ctx, sqlc.CreateWalletParams{
		UserID:    arg.UserID,
		Name:      arg.Name,
		Type:      arg.Type,
		Balance:   arg.Balance,
		Currency:  arg.Currency,
		IsDefault: arg.IsDefault,
		Icon:      arg.Icon,
		IconURL:   arg.IconURL,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.CreateWallet: %w", err)
	}
	return toWalletModel(row), nil
}

func (r *WalletRepository) CountWalletsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	count, err := r.q.CountWalletsByUser(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("repository.CountWalletsByUser: %w", err)
	}
	return count, nil
}

// ClearDefaultWallet is a no-op (affects zero rows) when the user has no
// current default — expected for a user's very first wallet.
func (r *WalletRepository) ClearDefaultWallet(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	if err := r.q.WithTx(tx).ClearDefaultWallet(ctx, userID); err != nil {
		return fmt.Errorf("repository.ClearDefaultWallet: %w", err)
	}
	return nil
}

func (r *WalletRepository) ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Wallet, error) {
	rows, err := r.q.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListWalletsByUser: %w", err)
	}
	wallets := make([]*model.Wallet, 0, len(rows))
	for _, row := range rows {
		wallets = append(wallets, toWalletModel(row))
	}
	return wallets, nil
}

// GetWalletByID returns pgx.ErrNoRows (unwrap with errors.Is) when no
// non-deleted wallet matches — it is NOT scoped by user_id (see
// db/queries/wallets.sql); the service layer decides 403 vs. 404.
func (r *WalletRepository) GetWalletByID(ctx context.Context, id uuid.UUID) (*model.Wallet, error) {
	row, err := r.q.GetWalletByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetWalletByID: %w", err)
	}
	return toWalletModel(row), nil
}

type UpdateWalletParams struct {
	ID       uuid.UUID
	UserID   uuid.UUID
	Name     *string
	Type     *string
	Currency *string
	Icon     *string
	// IconURL is only ever applied when IconURLProvided is true — see
	// dto.OptionalString / specs/wallet-budget-icons/plan.md Finding #1. A
	// nil IconURL with IconURLProvided=true means "clear the photo", not
	// "leave it alone".
	IconURL         *string
	IconURLProvided bool
}

// UpdateWallet is a single-row UPDATE ... RETURNING * — no transaction
// needed (plan.md Constitution Notes: "Transactional atomicity — Update: N/A").
// Returns pgx.ErrNoRows if id/user_id don't match a non-deleted row. Currency
// is only ever passed non-nil once WalletService has confirmed the 409
// CURRENCY_LOCKED check passes (specs/transaction-management/plan.md
// Finding #2 / WAL-T14).
func (r *WalletRepository) UpdateWallet(ctx context.Context, arg UpdateWalletParams) (*model.Wallet, error) {
	row, err := r.q.UpdateWallet(ctx, sqlc.UpdateWalletParams{
		ID:              arg.ID,
		UserID:          arg.UserID,
		Name:            arg.Name,
		Type:            arg.Type,
		Currency:        arg.Currency,
		Icon:            arg.Icon,
		IconURL:         arg.IconURL,
		IconURLProvided: arg.IconURLProvided,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.UpdateWallet: %w", err)
	}
	return toWalletModel(row), nil
}

// SetDefaultWallet returns pgx.ErrNoRows if id/user_id don't match a
// non-deleted row (ownership must already be checked by the caller before
// opening the transaction — this is the actual write, not the check).
func (r *WalletRepository) SetDefaultWallet(ctx context.Context, tx pgx.Tx, id, userID uuid.UUID) (*model.Wallet, error) {
	row, err := r.q.WithTx(tx).SetDefaultWallet(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.SetDefaultWallet: %w", err)
	}
	return toWalletModel(row), nil
}

// HasTransactionForWallet backs the 409 CURRENCY_LOCKED check in
// WalletService.UpdateWallet (specs/transaction-management/plan.md Finding
// #2 / WAL-T14) — queries the transactions table directly (a deliberate,
// narrow cross-repository exception, same precedent as F-05's
// HasActiveBudgetForCategory querying budgets from CategoryRepository).
func (r *WalletRepository) HasTransactionForWallet(ctx context.Context, walletID uuid.UUID) (bool, error) {
	exists, err := r.q.ExistsTransactionForWallet(ctx, walletID)
	if err != nil {
		return false, fmt.Errorf("repository.HasTransactionForWallet: %w", err)
	}
	return exists, nil
}

func toWalletModel(row sqlc.Wallet) *model.Wallet {
	return &model.Wallet{
		ID:        row.ID,
		UserID:    row.UserID,
		Name:      row.Name,
		Type:      model.WalletType(row.Type),
		Balance:   row.Balance,
		Currency:  row.Currency,
		IsDefault: row.IsDefault,
		Icon:      row.Icon,
		IconURL:   row.IconURL,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
		DeletedAt: row.DeletedAt,
	}
}
