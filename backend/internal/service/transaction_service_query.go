package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// ListTransactions implements US-02 — strictly scoped to the caller
// (CLAUDE.md user isolation rule), cursor-paginated on occurred_at (not
// created_at, spec.md Edge Cases US-02 #1). Returns plain values rather than
// a DTO, matching UserService.ListUsers's convention.
func (s *TransactionService) ListTransactions(ctx context.Context, userID uuid.UUID, q dto.ListTransactionsQuery) ([]*model.Transaction, *string, error) {
	filter := repository.ListTransactionsFilter{}

	if q.WalletID != "" {
		walletID, err := uuid.Parse(q.WalletID)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("wallet_id must be a valid UUID")
		}
		if _, err := s.getOwnedWallet(ctx, userID, walletID); err != nil {
			return nil, nil, err
		}
		filter.WalletID = &walletID
	}
	if q.CategoryID != "" {
		categoryID, err := uuid.Parse(q.CategoryID)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("category_id must be a valid UUID")
		}
		if _, err := s.getVisibleCategory(ctx, userID, categoryID); err != nil {
			return nil, nil, err
		}
		filter.CategoryID = &categoryID
	}
	if q.Type != "" {
		filter.Type = &q.Type
	}
	if q.From != "" {
		from, err := parseFlexibleTimestamp(q.From)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("from must be a valid date or timestamp")
		}
		filter.From = &from
	}
	if q.To != "" {
		to, err := parseFlexibleTimestamp(q.To)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("to must be a valid date or timestamp")
		}
		filter.To = &to
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		return nil, nil, common.NewInvalidInputError("from must not be after to")
	}
	if q.Cursor != "" {
		id, occurredAt, err := decodeTransactionCursor(q.Cursor)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("cursor is invalid")
		}
		filter.CursorID = &id
		filter.CursorOccurredAt = &occurredAt
	}

	limit := q.Limit
	if limit == 0 {
		limit = common.DefaultListLimit
	}
	// Fetch one extra row to know whether a next page exists, without a
	// separate COUNT-based lookahead query (same convention as
	// UserService.ListUsers) — this endpoint has no `total` field at all
	// (spec.md Response Shape), so no CountUsers-equivalent call is needed.
	filter.Limit = int32(limit + 1)

	transactions, err := s.repo.ListTransactionsByUser(ctx, userID, filter)
	if err != nil {
		return nil, nil, fmt.Errorf("service.ListTransactions: %w", err)
	}

	hasMore := len(transactions) > limit
	if hasMore {
		transactions = transactions[:limit]
	}

	var nextCursor *string
	if hasMore && len(transactions) > 0 {
		last := transactions[len(transactions)-1]
		c, err := encodeTransactionCursor(last.ID, last.OccurredAt)
		if err != nil {
			return nil, nil, fmt.Errorf("service.ListTransactions: %w", err)
		}
		nextCursor = &c
	}

	return transactions, nextCursor, nil
}

// GetTransaction implements US-03 — distinguishes "belongs to someone else"
// (403) from "doesn't exist" (404), per spec.md S-TRX-32/S-TRX-33.
func (s *TransactionService) GetTransaction(ctx context.Context, userID, transactionID uuid.UUID) (*model.Transaction, error) {
	return s.getOwnedTransaction(ctx, userID, transactionID)
}
