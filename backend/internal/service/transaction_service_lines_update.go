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

// lineUpdate is what UpdateTransaction resolved about Items before opening its
// tx (specs/transaction-line-items US-03). replace is false when the PATCH
// left the lists alone.
type lineUpdate struct {
	replace bool
	lines   repository.TransactionLines
	// expectedUpdatedAt is the version the client edited (BR-16); nil = no check.
	expectedUpdatedAt *time.Time
}

// lineEditResult is what the in-tx step hands back for the response and audit.
type lineEditResult struct {
	before repository.TransactionLines
	final  repository.TransactionLines
}

// resolveLineUpdate runs the shape checks that do not need the DB: PATCH
// semantics (plan F5), Kind-dependent line rules, the transfer rule and the
// expected_updated_at format.
func resolveLineUpdate(existing *model.Transaction, req dto.UpdateTransactionRequest) (lineUpdate, error) {
	update := lineUpdate{}
	if req.ExpectedUpdatedAt != nil {
		parsed, err := time.Parse(time.RFC3339Nano, *req.ExpectedUpdatedAt)
		if err != nil {
			return lineUpdate{}, common.NewInvalidInputError("expected_updated_at must be an RFC3339 timestamp")
		}
		update.expectedUpdatedAt = &parsed
	}
	if req.Items == nil {
		if req.Adjustments != nil {
			return lineUpdate{}, common.NewInvalidInputError("adjustments must be sent together with items")
		}
		return update, nil
	}

	var adjustments []dto.TransactionAdjustmentRequest
	if req.Adjustments != nil {
		adjustments = *req.Adjustments
	}
	lines, err := normalizeLines(*req.Items, adjustments)
	if err != nil {
		return lineUpdate{}, err
	}
	if existing.Type == model.TransactionTypeTransfer && hasLines(lines) {
		return lineUpdate{}, common.ErrItemsNotAllowed
	}
	update.replace = true
	update.lines = lines
	return update, nil
}

// needsLock reports whether this PATCH can affect the balance rule or must
// detect a stale copy — the cases that take the row lock (plan F1, F17).
func (u lineUpdate) needsLock(req dto.UpdateTransactionRequest) bool {
	return req.Amount != nil || u.replace || u.expectedUpdatedAt != nil
}

// checkLinesInTx locks the row, refuses a stale edit, and enforces the balance
// rule against the amount and lines as they will stand after this PATCH. Runs
// before any write in the tx, so a refusal leaves everything unchanged. The
// returned amount is the locked row's (fresher than the pre-tx read); without
// the lock it is the caller's existing amount.
func (s *TransactionService) checkLinesInTx(ctx context.Context, tx pgx.Tx, userID uuid.UUID, existing *model.Transaction, req dto.UpdateTransactionRequest, update lineUpdate) (repository.TransactionLines, int64, error) {
	transactionID := existing.ID
	if !update.needsLock(req) {
		return repository.TransactionLines{}, existing.Amount, nil
	}
	currentAmount, updatedAt, err := s.repo.LockTransactionForUpdate(ctx, tx, transactionID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.TransactionLines{}, 0, common.ErrTransactionNotFound
		}
		return repository.TransactionLines{}, 0, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	if update.expectedUpdatedAt != nil && !update.expectedUpdatedAt.Equal(updatedAt) {
		return repository.TransactionLines{}, 0, common.ErrTransactionChanged
	}

	current, err := s.repo.ListActiveLines(ctx, tx, transactionID, userID)
	if err != nil {
		return repository.TransactionLines{}, 0, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	if req.Amount == nil && !update.replace {
		return current, currentAmount, nil
	}
	effectiveAmount := currentAmount
	if req.Amount != nil {
		effectiveAmount = *req.Amount
	}
	effectiveLines := current
	if update.replace {
		effectiveLines = update.lines
	}
	if err := reconcile(effectiveAmount, effectiveLines); err != nil {
		return repository.TransactionLines{}, 0, err
	}
	return current, currentAmount, nil
}

// applyLinesInTx replaces the list when the PATCH sent one and returns the
// lines before and after, for the audit entry and the response. current is
// checkLinesInTx's read; it is re-read when the lock path did not run.
func (s *TransactionService) applyLinesInTx(ctx context.Context, tx pgx.Tx, userID, transactionID uuid.UUID, update lineUpdate, current repository.TransactionLines, locked bool) (lineEditResult, error) {
	if !locked {
		loaded, err := s.repo.ListActiveLines(ctx, tx, transactionID, userID)
		if err != nil {
			return lineEditResult{}, fmt.Errorf("service.UpdateTransaction: %w", err)
		}
		current = loaded
	}
	if !update.replace {
		return lineEditResult{before: current, final: current}, nil
	}
	if err := s.repo.SoftDeleteActiveLines(ctx, tx, transactionID, userID); err != nil {
		return lineEditResult{}, fmt.Errorf("service.UpdateTransaction: %w", err)
	}
	if hasLines(update.lines) {
		if err := s.repo.InsertTransactionLines(ctx, tx, transactionID, userID, update.lines); err != nil {
			return lineEditResult{}, fmt.Errorf("service.UpdateTransaction: %w", err)
		}
	}
	return lineEditResult{before: current, final: update.lines}, nil
}
