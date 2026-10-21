package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Moving an income/expense Transaction to another Wallet (PATCH wallet_id,
// 2026-10-13). The old Wallet gets the Transaction's effect back and the new
// Wallet takes it, at the new amount when the same PATCH changes it — both in
// the DB transaction that rewrites the row. Like every other update, no
// insufficient-balance floor applies (spec.md Context #3): the new Wallet's
// balance may land at zero or below.
//
// Every move keeps the currency (WALLET_CURRENCY_MISMATCH otherwise), so a
// Transaction's currency never changes. That is why the currency check can run
// before the tx even though the Wallet the row is on is only re-read under
// the lock: whatever Wallet a concurrent move left it on shares the currency.

// resolveWalletMove validates the PATCH's wallet_id before the tx opens. It
// returns nil when there is nothing to move: no wallet_id, or the Wallet the
// Transaction is already on.
func (s *TransactionService) resolveWalletMove(ctx context.Context, userID uuid.UUID, existing *model.Transaction, req dto.UpdateTransactionRequest) (*model.Wallet, error) {
	if req.WalletID == nil || *req.WalletID == existing.WalletID {
		return nil, nil
	}
	// A transfer names two Wallets and moves money between them; re-pointing
	// one side is a different transfer, not an edit of this one.
	if existing.Type == model.TransactionTypeTransfer {
		return nil, common.ErrTransferWalletImmutable
	}
	// 404 for a missing or soft-deleted Wallet, 403 for one the caller may
	// not record into — same split as a create (specs/shared-wallets BR-05).
	target, err := requireWritableWallet(ctx, s.walletRepo, userID, *req.WalletID)
	if err != nil {
		return nil, err
	}
	source, err := requireWritableWallet(ctx, s.walletRepo, userID, existing.WalletID)
	if err != nil {
		return nil, err
	}
	if target.Currency != source.Currency {
		return nil, common.ErrWalletCurrencyMismatch
	}
	return target, nil
}

// applyBalanceInTx applies this PATCH's effect on Wallet balances inside the
// caller's tx. existing carries the amount and Wallet read under the row lock.
// It returns the balance of the Wallet the Transaction ends up on, or nil when
// no balance changed (the "nil means untouched" convention of the response).
func (s *TransactionService) applyBalanceInTx(ctx context.Context, tx pgx.Tx, existing *model.Transaction, req dto.UpdateTransactionRequest, move *model.Wallet) (*int64, error) {
	oldSigned := existing.SignedEffect()
	newSigned := oldSigned
	if req.Amount != nil {
		// Type never changes, only magnitude, so the sign comes entirely from
		// the existing Transaction's own type (spec.md Edge Cases US-04 #3).
		after := *existing
		after.Amount = *req.Amount
		newSigned = after.SignedEffect()
	}

	// A concurrent PATCH may already have moved it there; then only the
	// amount (if any) is left to apply, on that Wallet.
	if move != nil && move.ID != existing.WalletID {
		return s.moveBalanceInTx(ctx, tx, existing.WalletID, move.ID, oldSigned, newSigned)
	}

	// Signed delta reconciliation, not a re-derivation from scratch.
	delta := newSigned - oldSigned
	if delta == 0 {
		return nil, nil
	}
	wallet, err := s.repo.AdjustWalletBalance(ctx, tx, existing.WalletID, delta)
	if err != nil {
		return nil, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	// A transfer's destination moves by the exact opposite.
	if err := s.adjustTransferDestination(ctx, tx, existing, delta); err != nil {
		return nil, err
	}
	return &wallet.Balance, nil
}

// moveBalanceInTx takes oldSigned back out of fromID and puts newSigned into
// toID, returning toID's new balance. The two writes always run in the same
// UUID order, so two opposite moves racing each other queue on the first
// Wallet's row lock instead of deadlocking.
func (s *TransactionService) moveBalanceInTx(ctx context.Context, tx pgx.Tx, fromID, toID uuid.UUID, oldSigned, newSigned int64) (*int64, error) {
	type adjustment struct {
		walletID uuid.UUID
		delta    int64
	}
	steps := []adjustment{{fromID, -oldSigned}, {toID, newSigned}}
	if bytes.Compare(toID[:], fromID[:]) < 0 {
		steps[0], steps[1] = steps[1], steps[0]
	}

	var balance *int64
	for _, step := range steps {
		wallet, err := s.repo.AdjustWalletBalance(ctx, tx, step.walletID, step.delta)
		if err != nil {
			// The new Wallet was soft-deleted after resolveWalletMove saw it.
			if errors.Is(err, pgx.ErrNoRows) && step.walletID == toID {
				return nil, common.ErrWalletNotFound
			}
			return nil, fmt.Errorf("service.moveBalanceInTx: %w", err)
		}
		if step.walletID == toID {
			newBalance := wallet.Balance
			balance = &newBalance
		}
	}
	return balance, nil
}
