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

// UpdateTransaction implements US-04. wallet_id and type are structurally
// excluded from dto.UpdateTransactionRequest (Context #5) — only amount,
// category_id, occurred_at, note, location (moving an existing pin: new
// coordinates + place name) and location_note can ever change; a pin can be
// moved but never added or removed. Always opens one DB
// transaction (plan.md Finding #13), even when amount is unchanged, so the
// balance adjustment (when present) and the row update never observably
// split. The insufficient-balance floor does NOT apply here (spec.md
// Context #3) — the resulting Wallet balance may land at zero or below.
// The second return value is the Wallet's new balance, non-nil only when
// `amount` actually changed it (spec.md US-04 step 7: "returns 200 ... and
// (if amount changed) the Wallet's new balance").
func (s *TransactionService) UpdateTransaction(ctx context.Context, userID, transactionID uuid.UUID, req dto.UpdateTransactionRequest) (*model.Transaction, *int64, error) {
	if !req.HasUpdates() {
		return nil, nil, common.NewInvalidInputError("at least one of amount, category_id, occurred_at, note, location, or location_note must be provided")
	}

	existing, err := s.getOwnedTransaction(ctx, userID, transactionID)
	if err != nil {
		return nil, nil, err
	}

	var categoryName string
	// A transfer is always filed under the system transfer Category.
	if req.CategoryID != nil && existing.Type == model.TransactionTypeTransfer {
		return nil, nil, common.ErrTransferCategoryImmutable
	}
	if req.CategoryID != nil {
		category, err := s.getVisibleCategory(ctx, userID, *req.CategoryID)
		if err != nil {
			return nil, nil, err
		}
		if string(category.Type) != string(existing.Type) {
			return nil, nil, common.ErrCategoryTypeMismatch
		}
		categoryName = category.Name
	}

	location, err := resolveLocationUpdate(existing, req)
	if err != nil {
		return nil, nil, err
	}

	var occurredAt *time.Time
	if req.OccurredAt != nil {
		parsed, err := parseFlexibleTimestamp(*req.OccurredAt)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("occurred_at must be a valid date or timestamp")
		}
		occurredAt = &parsed
	}

	transaction, walletBalance, err := s.updateTransactionTx(ctx, userID, transactionID, existing, req, occurredAt, location)
	if err != nil {
		return nil, nil, err
	}
	transaction.WalletName = existing.WalletName
	transaction.ToWalletName = existing.ToWalletName
	if categoryName != "" {
		transaction.CategoryName = categoryName
	} else {
		transaction.CategoryName = existing.CategoryName
	}
	return transaction, walletBalance, nil
}

// location is resolveLocationUpdate's result (nil parts = unchanged).
func (s *TransactionService) updateTransactionTx(ctx context.Context, userID, transactionID uuid.UUID, existing *model.Transaction, req dto.UpdateTransactionRequest, occurredAt *time.Time, location locationUpdate) (*model.Transaction, *int64, error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	var walletBalance *int64
	if req.Amount != nil {
		// Signed delta reconciliation, not a re-derivation from scratch
		// (spec.md Edge Cases US-04 #3) — type never changes, only
		// magnitude, so the sign comes entirely from the existing
		// Transaction's own (immutable) type.
		oldSigned := existing.SignedEffect()
		newSigned := *req.Amount
		if existing.Type == model.TransactionTypeExpense || existing.Type == model.TransactionTypeTransfer {
			newSigned = -newSigned
		}
		delta := newSigned - oldSigned
		if delta != 0 {
			// Unconditional — no floor check (spec.md Context #3); the
			// resulting balance may land at zero or below.
			wallet, err := s.repo.AdjustWalletBalance(ctx, tx, existing.WalletID, delta)
			if err != nil {
				return nil, nil, fmt.Errorf("service.UpdateTransaction: %w", err)
			}
			walletBalance = &wallet.Balance
			// A transfer's destination moves by the exact opposite.
			if err := s.adjustTransferDestination(ctx, tx, existing, delta); err != nil {
				return nil, nil, err
			}
		}
	}

	params := repository.UpdateTransactionParams{
		ID:           transactionID,
		UserID:       userID,
		Amount:       req.Amount,
		CategoryID:   req.CategoryID,
		OccurredAt:   occurredAt,
		Note:         req.Note,
		LocationNote: location.Note,
	}
	if move := location.Move; move != nil {
		params.LocationLat = &move.Latitude
		params.LocationLng = &move.Longitude
		params.LocationName = move.PlaceName
	}
	transaction, err := s.repo.UpdateTransaction(ctx, tx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race to a concurrent update/delete of the same
			// Transaction between the ownership check above and this write.
			return nil, nil, common.ErrTransactionNotFound
		}
		return nil, nil, fmt.Errorf("service.UpdateTransaction: %w", err)
	}

	// Records only the fields this PATCH actually supplied, in the same
	// transaction as the row update above (specs/transaction-audit-log/
	// spec.md US-01, Context #1/#4).
	auditBefore, auditAfter := auditUpdateDiff(existing, req, occurredAt, location)
	if err := s.writeAuditLog(ctx, tx, userID, transactionID, model.AuditActionUpdate, auditBefore, auditAfter); err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	return transaction, walletBalance, nil
}

// DeleteTransaction implements US-05. No dependency check needed — nothing
// in the MVP schema references transactions.id. The Wallet-balance reversal
// and the soft-delete run inside one DB transaction; the insufficient-
// balance floor does NOT apply here either (spec.md Context #3) — the
// resulting Wallet balance may land at zero or below.
func (s *TransactionService) DeleteTransaction(ctx context.Context, userID, transactionID uuid.UUID) (*model.Wallet, error) {
	existing, err := s.getOwnedTransaction(ctx, userID, transactionID)
	if err != nil {
		return nil, err
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("service.DeleteTransaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	reversal := -existing.SignedEffect()
	wallet, err := s.repo.AdjustWalletBalance(ctx, tx, existing.WalletID, reversal)
	if err != nil {
		return nil, fmt.Errorf("service.DeleteTransaction: %w", err)
	}
	// Deleting a transfer takes the money back out of its destination too.
	if err := s.adjustTransferDestination(ctx, tx, existing, reversal); err != nil {
		return nil, err
	}

	if _, err := s.repo.SoftDeleteTransaction(ctx, tx, transactionID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Lost a race to a concurrent delete of the same Transaction
			// between the ownership check above and this write.
			return nil, common.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("service.DeleteTransaction: %w", err)
	}

	// Full snapshot as it stood at deletion time, in the same transaction as
	// the balance reversal and the soft-delete (specs/transaction-audit-log/
	// spec.md S-TAL-04) — the row itself survives (soft delete), but this is
	// what makes "what exactly did I delete, and when" answerable.
	if err := s.writeAuditLog(ctx, tx, userID, transactionID, model.AuditActionDelete, auditSnapshot(existing), nil); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("service.DeleteTransaction: %w", err)
	}
	return wallet, nil
}
