package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// WalletService owns F-03's business rules — default-wallet forcing, the
// atomic default-swap, and ownership checks. Shape validation (name/type/
// currency/balance format) stays in dto/handler, never here.
type WalletService struct {
	repo   WalletRepo
	logger *zap.Logger
}

func NewWalletService(repo WalletRepo, logger *zap.Logger) *WalletService {
	return &WalletService{repo: repo, logger: logger}
}

// CreateWallet implements US-01. The caller's very first wallet always
// becomes the default regardless of what was requested (spec.md S-WAL-01);
// a later wallet only becomes default if explicitly requested, in which case
// the previous default is atomically cleared first (S-WAL-03).
func (s *WalletService) CreateWallet(ctx context.Context, userID uuid.UUID, req dto.CreateWalletRequest) (*model.Wallet, error) {
	currency := req.Currency
	if currency == "" {
		currency = common.WalletDefaultCurrency
	}

	count, err := s.repo.CountWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.CreateWallet: %w", err)
	}
	forceDefault := count == 0
	wantDefault := forceDefault || req.IsDefault

	wallet, err := s.createWalletTx(ctx, userID, req, currency, wantDefault)
	if err != nil {
		if wantDefault && isUniqueViolation(err) {
			// Lost the race to become default to a concurrent request for
			// this same user (spec.md S-WAL-10) — this wallet still gets
			// created, just not as the default.
			wallet, err = s.createWalletTx(ctx, userID, req, currency, false)
		}
		if err != nil {
			return nil, fmt.Errorf("service.CreateWallet: %w", err)
		}
	}
	return wallet, nil
}

func (s *WalletService) createWalletTx(ctx context.Context, userID uuid.UUID, req dto.CreateWalletRequest, currency string, makeDefault bool) (*model.Wallet, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.createWalletTx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if makeDefault {
		if err := s.repo.ClearDefaultWallet(ctx, tx, userID); err != nil {
			return nil, fmt.Errorf("service.createWalletTx: %w", err)
		}
	}

	wallet, err := s.repo.CreateWallet(ctx, tx, repository.CreateWalletParams{
		UserID:    userID,
		Name:      req.Name,
		Type:      req.Type,
		Balance:   req.InitialBalance,
		Currency:  currency,
		IsDefault: makeDefault,
		Icon:      req.Icon,
		IconURL:   req.IconURL,
	})
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.createWalletTx: %w", err)
	}
	return wallet, nil
}

// ListWallets implements US-02 — strictly scoped to the caller (CLAUDE.md
// user isolation rule); ordering (default wallet first) is the repository
// query's job, not the service's.
func (s *WalletService) ListWallets(ctx context.Context, userID uuid.UUID) ([]*model.Wallet, error) {
	wallets, err := s.repo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ListWallets: %w", err)
	}
	return wallets, nil
}

// GetWallet implements US-03 — distinguishes "belongs to someone else"
// (403) from "doesn't exist" (404), per spec.md S-WAL-16/S-WAL-17.
func (s *WalletService) GetWallet(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	return s.getOwnedWallet(ctx, userID, walletID)
}

// getOwnedWallet fetches a wallet by ID and enforces ownership — shared by
// GetWallet, UpdateWallet, and SetDefaultWallet so the 403-vs-404 split is
// decided in exactly one place.
func (s *WalletService) getOwnedWallet(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := s.repo.GetWalletByID(ctx, walletID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrWalletNotFound
		}
		return nil, fmt.Errorf("service.getOwnedWallet: %w", err)
	}
	if wallet.UserID != userID {
		return nil, common.ErrWalletAccessDenied
	}
	return wallet, nil
}

// UpdateWallet implements US-04. Currency-lock (S-WAL-21, 409
// CURRENCY_LOCKED) is now wired up (specs/transaction-management/plan.md
// Finding #2 / WAL-T14, closing the deferral this comment used to describe)
// — a currency change is rejected once any non-deleted Transaction
// references the wallet. A currency value equal to the wallet's current one
// is not treated as a "change" and never triggers the check. Icon/IconURL
// are independent of the currency lock — never gated by it
// (specs/wallet-budget-icons/spec.md Edge Case US-02 #3).
func (s *WalletService) UpdateWallet(ctx context.Context, userID, walletID uuid.UUID, req dto.UpdateWalletRequest) (*model.Wallet, error) {
	if !req.HasUpdates() {
		return nil, common.NewInvalidInputError("at least one of name, type, currency, icon, or icon_url must be provided")
	}
	wallet, err := s.getOwnedWallet(ctx, userID, walletID)
	if err != nil {
		return nil, err
	}

	if req.Currency != nil && *req.Currency != wallet.Currency {
		hasTransaction, err := s.repo.HasTransactionForWallet(ctx, walletID)
		if err != nil {
			return nil, fmt.Errorf("service.UpdateWallet: %w", err)
		}
		if hasTransaction {
			return nil, common.ErrCurrencyLocked
		}
	}

	updated, err := s.repo.UpdateWallet(ctx, repository.UpdateWalletParams{
		ID:              walletID,
		UserID:          userID,
		Name:            req.Name,
		Type:            req.Type,
		Currency:        req.Currency,
		Icon:            req.Icon,
		IconURL:         req.IconURL.Value,
		IconURLProvided: req.IconURL.Set,
	})
	if err != nil {
		return nil, fmt.Errorf("service.UpdateWallet: %w", err)
	}
	return updated, nil
}

// SetDefaultWallet implements US-05. Calling this on an already-default
// wallet is an idempotent no-op (spec.md S-WAL-26); losing a concurrent race
// for this same user (S-WAL-29) still returns 200 with the wallet's current,
// settled state rather than surfacing an error to the caller.
func (s *WalletService) SetDefaultWallet(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := s.getOwnedWallet(ctx, userID, walletID)
	if err != nil {
		return nil, err
	}
	if wallet.IsDefault {
		return wallet, nil
	}

	updated, err := s.setDefaultWalletTx(ctx, userID, walletID)
	if err != nil {
		if isUniqueViolation(err) {
			return s.getOwnedWallet(ctx, userID, walletID)
		}
		return nil, fmt.Errorf("service.SetDefaultWallet: %w", err)
	}
	return updated, nil
}

func (s *WalletService) setDefaultWalletTx(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.setDefaultWalletTx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if err := s.repo.ClearDefaultWallet(ctx, tx, userID); err != nil {
		return nil, fmt.Errorf("service.setDefaultWalletTx: %w", err)
	}
	wallet, err := s.repo.SetDefaultWallet(ctx, tx, walletID, userID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.setDefaultWalletTx: %w", err)
	}
	return wallet, nil
}
