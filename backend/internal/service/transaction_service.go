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

// requireWritableEntry is the wallet half of editing or deleting an entry:
// the recorder (getOwnedTransaction) must still be able to record into every
// wallet the entry moves, or a member removed from a shared wallet could
// still change its balance (specs/shared-wallets BR-07, S-SHW-34).
func (s *TransactionService) requireWritableEntry(ctx context.Context, userID uuid.UUID, t *model.Transaction) error {
	if _, err := requireWritableWallet(ctx, s.walletRepo, userID, t.WalletID); err != nil {
		return err
	}
	if t.ToWalletID != nil {
		if _, err := requireWritableWallet(ctx, s.walletRepo, userID, *t.ToWalletID); err != nil {
			return err
		}
	}
	return nil
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

// checkVisibleCategories is getVisibleCategory for a list, in one query
// instead of one per id. The first id, in the order given, that is missing
// or someone else's fails exactly as getVisibleCategory would: 404
// CATEGORY_NOT_FOUND or 403 CATEGORY_ACCESS_DENIED.
func (s *TransactionService) checkVisibleCategories(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	categories, err := s.categoryRepo.GetCategoriesByIDs(ctx, ids)
	if err != nil {
		return fmt.Errorf("service.checkVisibleCategories: %w", err)
	}
	byID := make(map[uuid.UUID]*model.Category, len(categories))
	for _, category := range categories {
		byID[category.ID] = category
	}
	for _, id := range ids {
		category, ok := byID[id]
		if !ok {
			return common.ErrCategoryNotFound
		}
		if !category.IsSystem() && *category.UserID != userID {
			return common.ErrCategoryAccessDenied
		}
	}
	return nil
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
