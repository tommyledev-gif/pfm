package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// AuditLogService owns the read half of the Transaction Audit Log feature
// (specs/transaction-audit-log/spec.md US-02). The write half deliberately
// does not live here — it is one statement inside TransactionService's own
// existing DB transaction (transaction_service_audit.go), because an audit
// entry that could be written independently of the mutation it records could
// also be missing for one, which is the whole failure mode this feature
// exists to prevent.
//
// Depends on TransactionRepo alongside its own AuditLogRepo purely to enforce
// ownership of the optional ?transaction_id= filter — same shape of
// cross-feature read dependency TransactionService already has on
// WalletRepo/CategoryRepo.
type AuditLogService struct {
	repo            AuditLogRepo
	transactionRepo TransactionRepo
	logger          *zap.Logger
}

func NewAuditLogService(repo AuditLogRepo, transactionRepo TransactionRepo, logger *zap.Logger) *AuditLogService {
	return &AuditLogService{repo: repo, transactionRepo: transactionRepo, logger: logger}
}

// ListAuditLogs implements US-02 — strictly scoped to the caller
// (CLAUDE.md user-isolation rule), cursor-paginated on (created_at, id).
func (s *AuditLogService) ListAuditLogs(ctx context.Context, userID uuid.UUID, transactionIDStr, cursor string, limit int) ([]*model.AuditLog, *string, int64, error) {
	var transactionID *uuid.UUID
	if transactionIDStr != "" {
		parsed, err := uuid.Parse(transactionIDStr)
		if err != nil {
			return nil, nil, 0, common.NewInvalidInputError("transaction_id must be a valid UUID")
		}
		// Ownership of the filtered Transaction is checked exactly the way
		// GET /transactions/{id} checks it (403 for someone else's, 404 for
		// absent) — filtering by another user's Transaction must not quietly
		// return an empty page as if they simply had no history.
		if _, err := s.getOwnedTransactionForAudit(ctx, userID, parsed); err != nil {
			return nil, nil, 0, err
		}
		transactionID = &parsed
	}

	var cursorCreatedAt *time.Time
	var cursorID *uuid.UUID
	if cursor != "" {
		id, createdAt, err := decodeCursor(cursor)
		if err != nil {
			return nil, nil, 0, common.NewInvalidInputError("cursor is invalid")
		}
		cursorCreatedAt = &createdAt
		cursorID = &id
	}

	// One extra row tells us whether a next page exists without a second
	// lookahead query — same convention as UserService/NotificationService.
	logs, err := s.repo.ListAuditLogsByUser(ctx, userID, repository.ListAuditLogsFilter{
		TransactionID:   transactionID,
		CursorCreatedAt: cursorCreatedAt,
		CursorID:        cursorID,
		Limit:           int32(limit + 1),
	})
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListAuditLogs: %w", err)
	}

	hasMore := len(logs) > limit
	if hasMore {
		logs = logs[:limit]
	}

	var nextCursor *string
	if hasMore && len(logs) > 0 {
		last := logs[len(logs)-1]
		encoded, err := encodeCursor(last.ID, last.CreatedAt)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("service.ListAuditLogs: %w", err)
		}
		nextCursor = &encoded
	}

	total, err := s.repo.CountAuditLogs(ctx, userID, transactionID)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListAuditLogs: %w", err)
	}

	return logs, nextCursor, total, nil
}

// getOwnedTransactionForAudit mirrors TransactionService.getOwnedTransaction's
// 403-vs-404 split — duplicated rather than shared for the same reason that
// helper is itself duplicated across services (each owns its own repository
// dependency), see TransactionService.getOwnedWallet's note.
func (s *AuditLogService) getOwnedTransactionForAudit(ctx context.Context, userID, transactionID uuid.UUID) (*model.Transaction, error) {
	transaction, err := s.transactionRepo.GetTransactionByID(ctx, transactionID)
	if err != nil {
		return nil, common.ErrTransactionNotFound
	}
	if transaction.UserID != userID {
		return nil, common.ErrTransactionAccessDenied
	}
	return transaction, nil
}
