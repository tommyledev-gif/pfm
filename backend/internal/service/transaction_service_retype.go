package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Changing a Transaction's type (PATCH type, 2026-11-05): income and expense
// either way, or to and from a transfer — an AI proposal confirmed as the
// wrong kind used to be fixable only by deleting it. The old effect on every
// Wallet it touched is taken back and the new one applied, in the DB
// transaction that rewrites the row. Like every other update, no
// insufficient-balance floor applies (spec.md Context #3).
//
// Becoming a transfer files the row under the system transfer Category and
// drops its Items (resolveLineUpdate); leaving one clears the destination
// (the UPDATE rewrites to_wallet_id with the type).

// typeChange is what UpdateTransaction resolved about a new type before its
// tx opens; nil means the type stays.
type typeChange struct {
	to model.TransactionType
	// The new transfer's destination; nil unless `to` is a transfer.
	destination *model.Wallet
	// The system transfer Category, when `to` is a transfer. Becoming
	// income/expense takes the PATCH's own category_id instead.
	category *model.Category
}

// resultType is the type a Transaction has once this PATCH is applied.
func resultType(existing *model.Transaction, req dto.UpdateTransactionRequest) model.TransactionType {
	if req.Type == nil {
		return existing.Type
	}
	return model.TransactionType(*req.Type)
}

// resolveTypeChange validates the PATCH's type and to_wallet_id. move is
// resolveWalletMove's result: the Wallet a new transfer is sent from when
// the same PATCH moves it.
func (s *TransactionService) resolveTypeChange(ctx context.Context, userID uuid.UUID, existing *model.Transaction, req dto.UpdateTransactionRequest, move *model.Wallet) (*typeChange, error) {
	to := resultType(existing, req)
	if to == existing.Type {
		if req.ToWalletID == nil {
			return nil, nil
		}
		if existing.Type != model.TransactionTypeTransfer {
			return nil, common.NewInvalidInputError("to_wallet_id is only for a transfer")
		}
		// A transfer's destination is one of the two Wallets it names: like
		// its source, it never moves (TRANSFER_WALLET_IMMUTABLE).
		if existing.ToWalletID != nil && *req.ToWalletID == *existing.ToWalletID {
			return nil, nil
		}
		return nil, common.ErrTransferWalletImmutable
	}

	if to != model.TransactionTypeTransfer {
		if req.ToWalletID != nil {
			return nil, common.NewInvalidInputError("to_wallet_id is only for a transfer")
		}
		// The old Category is of the old type: the PATCH must name one of the
		// new type, which UpdateTransaction checks with any category_id.
		if req.CategoryID == nil {
			return nil, common.NewInvalidInputError("category_id is required to change the type")
		}
		return &typeChange{to: to}, nil
	}

	if req.CategoryID != nil {
		return nil, common.ErrTransferCategoryImmutable
	}
	source := move
	if source == nil {
		wallet, err := requireWritableWallet(ctx, s.walletRepo, userID, existing.WalletID)
		if err != nil {
			return nil, err
		}
		source = wallet
	}
	destination, category, err := s.resolveTransfer(ctx, userID, source, req.ToWalletID)
	if err != nil {
		return nil, err
	}
	return &typeChange{to: to, destination: destination, category: category}, nil
}

// sameWalletID reports whether two optional Wallet ids name the same Wallet
// (both absent counts).
func sameWalletID(a, b *uuid.UUID) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// after is the Transaction as this PATCH leaves it, for the balance moves:
// existing carries the amount and Wallet read under the row lock.
func (c *typeChange) after(existing *model.Transaction, req dto.UpdateTransactionRequest, move *model.Wallet) *model.Transaction {
	next := *existing
	next.Type = c.to
	next.ToWalletID = nil
	if c.destination != nil {
		next.ToWalletID = &c.destination.ID
	}
	if req.Amount != nil {
		next.Amount = *req.Amount
	}
	if move != nil {
		next.WalletID = move.ID
	}
	return &next
}

// retypeBalanceInTx takes `before`'s effect back off every Wallet it touched
// and applies `after`'s, netted per Wallet. It returns the new balance of the
// Wallet the Transaction ends up on, or nil when that one did not move.
// Written in UUID order, like moveBalanceInTx, so two edits racing over the
// same Wallets queue instead of deadlocking.
func (s *TransactionService) retypeBalanceInTx(ctx context.Context, tx pgx.Tx, before, after *model.Transaction) (*int64, error) {
	deltas := map[uuid.UUID]int64{}
	deltas[before.WalletID] -= before.SignedEffect()
	// A transfer's destination took the amount in; it gives it back.
	if before.Type == model.TransactionTypeTransfer && before.ToWalletID != nil {
		deltas[*before.ToWalletID] -= before.Amount
	}
	deltas[after.WalletID] += after.SignedEffect()
	if after.Type == model.TransactionTypeTransfer && after.ToWalletID != nil {
		deltas[*after.ToWalletID] += after.Amount
	}

	ids := make([]uuid.UUID, 0, len(deltas))
	for id, delta := range deltas {
		if delta != 0 {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return bytes.Compare(ids[i][:], ids[j][:]) < 0 })

	var balance *int64
	for _, id := range ids {
		wallet, err := s.repo.AdjustWalletBalance(ctx, tx, id, deltas[id])
		if err != nil {
			// A Wallet named by this PATCH was soft-deleted after it was checked.
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, common.ErrWalletNotFound
			}
			return nil, fmt.Errorf("service.retypeBalanceInTx: %w", err)
		}
		if id == after.WalletID {
			newBalance := wallet.Balance
			balance = &newBalance
		}
	}
	return balance, nil
}
