package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// Transfers (022_transaction_transfer.sql): one row that moves money from
// WalletID (source) to ToWalletID (destination), both the caller's own.
//
// Balance rules, applied in the same DB transaction as the row write:
//   - create: source is decremented with the same insufficient-balance floor
//     as an expense; destination is incremented unconditionally.
//   - update (amount only — wallets, type and category never change; a
//     wallet_id on a transfer is TRANSFER_WALLET_IMMUTABLE): the source
//     moves by the signed delta, the destination by its opposite.
//   - delete: both moves are reversed.
// Neither side ever counts as income or expense; the aggregate queries
// exclude type 'transfer' themselves.

func isTransfer(t string) bool { return t == string(model.TransactionTypeTransfer) }

// resolveTransfer validates a transfer's destination against its already
// ownership-checked source and returns it along with the system transfer
// Category the row is filed under.
func (s *TransactionService) resolveTransfer(ctx context.Context, userID uuid.UUID, source *model.Wallet, toWalletID *uuid.UUID) (*model.Wallet, *model.Category, error) {
	if toWalletID == nil {
		// The DTO's required_if already rejects this; kept so the service
		// never relies on the handler for a rule it enforces.
		return nil, nil, common.NewInvalidInputError("to_wallet_id is required for a transfer")
	}
	if *toWalletID == source.ID {
		return nil, nil, common.ErrTransferSameWallet
	}
	destination, err := s.getOwnedWallet(ctx, userID, *toWalletID)
	if err != nil {
		return nil, nil, err
	}
	if destination.Currency != source.Currency {
		return nil, nil, common.ErrTransferCurrencyMismatch
	}
	category, err := s.categoryRepo.GetSystemCategoryByKey(ctx, model.SystemKeyTransfer)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Migration 022 seeds it; missing means the schema is behind.
			return nil, nil, fmt.Errorf("service.resolveTransfer: transfer category not seeded: %w", err)
		}
		return nil, nil, fmt.Errorf("service.resolveTransfer: %w", err)
	}
	return destination, category, nil
}

// adjustTransferDestination moves a transfer's destination Wallet by the
// opposite of whatever its source just moved by, inside the caller's tx.
func (s *TransactionService) adjustTransferDestination(ctx context.Context, tx pgx.Tx, t *model.Transaction, sourceDelta int64) error {
	if t.Type != model.TransactionTypeTransfer || t.ToWalletID == nil || sourceDelta == 0 {
		return nil
	}
	if _, err := s.repo.AdjustWalletBalance(ctx, tx, *t.ToWalletID, -sourceDelta); err != nil {
		return fmt.Errorf("service.adjustTransferDestination: %w", err)
	}
	return nil
}
