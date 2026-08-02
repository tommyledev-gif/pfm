package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// CreateTransaction implements US-01. The Wallet-balance mutation (conditional
// decrement for expense, unconditional increment for income) and the row
// insert run inside one DB transaction (CLAUDE.md rule, spec.md Edge Cases
// US-01 #2).
func (s *TransactionService) CreateTransaction(ctx context.Context, userID uuid.UUID, req dto.CreateTransactionRequest) (*model.Transaction, int64, error) {
	wallet, err := s.getOwnedWallet(ctx, userID, req.WalletID)
	if err != nil {
		return nil, 0, err
	}
	category, err := s.getVisibleCategory(ctx, userID, req.CategoryID)
	if err != nil {
		return nil, 0, err
	}
	if string(category.Type) != req.Type {
		return nil, 0, common.ErrCategoryTypeMismatch
	}

	occurredAt := time.Now().UTC()
	if req.OccurredAt != nil {
		parsed, err := parseFlexibleTimestamp(*req.OccurredAt)
		if err != nil {
			return nil, 0, common.NewInvalidInputError("occurred_at must be a valid date or timestamp")
		}
		occurredAt = parsed
	}

	transaction, walletBalance, err := s.createTransactionTx(ctx, userID, wallet.ID, req, occurredAt)
	if err != nil {
		return nil, 0, err
	}
	transaction.WalletName = wallet.Name
	transaction.CategoryName = category.Name
	return transaction, walletBalance, nil
}

// createTransactionTx returns the Wallet's new balance alongside the created
// Transaction (spec.md US-01 step 8: "returns 201 with the created
// Transaction and the Wallet's new balance").
func (s *TransactionService) createTransactionTx(ctx context.Context, userID uuid.UUID, walletID uuid.UUID, req dto.CreateTransactionRequest, occurredAt time.Time) (*model.Transaction, int64, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	var walletBalance int64
	if req.Type == string(model.TransactionTypeExpense) {
		// The WHERE balance >= amount clause IS the concurrency guard
		// (spec.md Context #4) — zero rows affected (pgx.ErrNoRows) is the
		// authoritative INSUFFICIENT_BALANCE signal, closing the race
		// between two concurrent expense requests without a separate lock.
		wallet, err := s.repo.DecrementWalletBalanceIfSufficient(ctx, tx, walletID, req.Amount)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, 0, common.ErrInsufficientBalance
			}
			return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
		}
		walletBalance = wallet.Balance
	} else {
		wallet, err := s.repo.AdjustWalletBalance(ctx, tx, walletID, req.Amount)
		if err != nil {
			return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
		}
		walletBalance = wallet.Balance
	}

	transaction, err := s.repo.CreateTransaction(ctx, tx, repository.CreateTransactionParams{
		UserID:     userID,
		WalletID:   walletID,
		CategoryID: req.CategoryID,
		Amount:     req.Amount,
		Type:       req.Type,
		Note:       req.Note,
		OccurredAt: occurredAt,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
	}
	return transaction, walletBalance, nil
}
