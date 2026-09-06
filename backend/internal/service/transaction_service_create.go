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
//
// The returned *int64 is nil exactly when the Wallet balance was not touched
// by this call — same "nil means untouched" convention as UpdateTransaction/
// dto.NewTransactionResponseWithBalance already use. On a replay
// (wasReplay=true), nothing was mutated, so no balance is returned — this
// call made no change for the caller to be informed of.
//
// The returned bool is wasReplay (specs/ai-chat-assistant/spec.md Resolved
// design decision #5) — true means req.IdempotencyKey matched an
// already-created Transaction and nothing new was written; the handler picks
// 200 vs 201 based on it. Every caller that omits IdempotencyKey (every
// pre-existing call site) always gets wasReplay=false, i.e. unchanged 201
// behavior (specs/ai-chat-assistant/plan.md Regression Scope).
func (s *TransactionService) CreateTransaction(ctx context.Context, userID uuid.UUID, req dto.CreateTransactionRequest) (*model.Transaction, *int64, bool, error) {
	if req.IdempotencyKey != nil {
		existing, err := s.lookupIdempotentTransaction(ctx, userID, *req.IdempotencyKey)
		if err == nil {
			return existing, nil, true, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, false, fmt.Errorf("service.CreateTransaction: %w", err)
		}
	}

	wallet, err := s.getOwnedWallet(ctx, userID, req.WalletID)
	if err != nil {
		return nil, nil, false, err
	}
	category, err := s.getVisibleCategory(ctx, userID, req.CategoryID)
	if err != nil {
		return nil, nil, false, err
	}
	if string(category.Type) != req.Type {
		return nil, nil, false, common.ErrCategoryTypeMismatch
	}

	occurredAt := time.Now().UTC()
	if req.OccurredAt != nil {
		parsed, err := parseFlexibleTimestamp(*req.OccurredAt)
		if err != nil {
			return nil, nil, false, common.NewInvalidInputError("occurred_at must be a valid date or timestamp")
		}
		occurredAt = parsed
	}

	transaction, walletBalance, err := s.createTransactionTx(ctx, userID, wallet.ID, req, occurredAt)
	if err != nil {
		// Two confirms racing past the lookup above with the same fresh key
		// (specs/ai-chat-assistant/plan.md Finding #13): the partial unique
		// index rejects the loser's insert. Re-look-up and return the
		// winner's Transaction as a replay instead of a raw 500 — the DB
		// constraint, not the lookup, is the actual concurrency guard.
		if req.IdempotencyKey != nil && isUniqueViolation(err) {
			if existing, lookupErr := s.lookupIdempotentTransaction(ctx, userID, *req.IdempotencyKey); lookupErr == nil {
				return existing, nil, true, nil
			}
		}
		return nil, nil, false, err
	}
	transaction.WalletName = wallet.Name
	transaction.CategoryName = category.Name
	return transaction, &walletBalance, false, nil
}

// lookupIdempotentTransaction returns the existing Transaction for a
// previously-used idempotency key, or a pgx.ErrNoRows-wrapping error if the
// key is fresh (checked via errors.Is by callers).
func (s *TransactionService) lookupIdempotentTransaction(ctx context.Context, userID, key uuid.UUID) (*model.Transaction, error) {
	return s.repo.GetTransactionByIdempotencyKey(ctx, userID, key)
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
		UserID:         userID,
		WalletID:       walletID,
		CategoryID:     req.CategoryID,
		Amount:         req.Amount,
		Type:           req.Type,
		Note:           req.Note,
		OccurredAt:     occurredAt,
		IdempotencyKey: req.IdempotencyKey,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
	}

	// Same transaction as the balance mutation and the insert above
	// (specs/transaction-audit-log/spec.md Context #1). A replayed create
	// (wasReplay=true) never reaches here — CreateTransaction returns before
	// opening this transaction at all — so a replay correctly writes no
	// second entry for a Transaction that was not written again.
	if err := s.writeAuditLog(ctx, tx, userID, transaction.ID, model.AuditActionCreate, nil, auditSnapshot(transaction)); err != nil {
		return nil, 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, 0, fmt.Errorf("service.CreateTransaction: %w", err)
	}
	return transaction, walletBalance, nil
}
