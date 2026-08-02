package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// TransactionService owns F-06's business rules — Wallet/Category
// existence+visibility+type-match checks, the atomic (conditional-vs-
// unconditional) wallet-balance mutation, and cursor encode/decode. Shape
// validation (amount/type/note format) stays in dto/handler, never here.
// Depends on WalletRepo and CategoryRepo directly, alongside its own
// TransactionRepo — SDS §5.6 lists WalletRepository/CategoryRepository as
// "Layers Involved" for Transaction creation, and this service reuses their
// existing GetWalletByID/GetCategoryByID lookups rather than duplicating them.
//
// Split across transaction_service.go (struct, shared ownership/visibility
// helpers), transaction_service_create.go (US-01),
// transaction_service_query.go (US-02/US-03), and
// transaction_service_mutate.go (US-04/US-05) — CLAUDE.md's 300-line file cap.
type TransactionService struct {
	repo         TransactionRepo
	walletRepo   WalletRepo
	categoryRepo CategoryRepo
	logger       *zap.Logger
}

func NewTransactionService(repo TransactionRepo, walletRepo WalletRepo, categoryRepo CategoryRepo, logger *zap.Logger) *TransactionService {
	return &TransactionService{repo: repo, walletRepo: walletRepo, categoryRepo: categoryRepo, logger: logger}
}

// getOwnedTransaction fetches a Transaction by ID and enforces ownership —
// shared by GetTransaction, UpdateTransaction, and DeleteTransaction so the
// 403-vs-404 split is decided in exactly one place.
func (s *TransactionService) getOwnedTransaction(ctx context.Context, userID, transactionID uuid.UUID) (*model.Transaction, error) {
	transaction, err := s.repo.GetTransactionByID(ctx, transactionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("service.getOwnedTransaction: %w", err)
	}
	if transaction.UserID != userID {
		return nil, common.ErrTransactionAccessDenied
	}
	return transaction, nil
}

// getOwnedWallet mirrors WalletService's own helper — duplicated here rather
// than shared because it belongs to a different service's dependency
// (WalletRepo), same reasoning as CategoryService/BudgetService each having
// their own small ownership helpers instead of a shared cross-service one.
func (s *TransactionService) getOwnedWallet(ctx context.Context, userID, walletID uuid.UUID) (*model.Wallet, error) {
	wallet, err := s.walletRepo.GetWalletByID(ctx, walletID)
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

// getVisibleCategory mirrors CategoryService's own visibility check — system
// categories are always visible, the caller's own are visible, anything else
// is a 403.
func (s *TransactionService) getVisibleCategory(ctx context.Context, userID, categoryID uuid.UUID) (*model.Category, error) {
	category, err := s.categoryRepo.GetCategoryByID(ctx, categoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrCategoryNotFound
		}
		return nil, fmt.Errorf("service.getVisibleCategory: %w", err)
	}
	if category.IsSystem() || *category.UserID == userID {
		return category, nil
	}
	return nil, common.ErrCategoryAccessDenied
}

// parseFlexibleTimestamp accepts either a full RFC3339 timestamp or a plain
// date ("2006-01-02", interpreted as UTC midnight) — SRS's own example
// scenarios pass bare dates (e.g. "2025-12-23") for occurred_at, which
// encoding/json cannot unmarshal directly into a time.Time. Used for
// occurred_at (Create/Update) and the from/to list filters alike.
func parseFlexibleTimestamp(value string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t.UTC(), nil
	}
	t, err := time.Parse(common.DateOnlyLayout, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("parseFlexibleTimestamp: %w", err)
	}
	return t.UTC(), nil
}
