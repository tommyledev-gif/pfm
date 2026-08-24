package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// likeEscaper escapes ILIKE's own wildcard characters (and its escape
// character) in a caller-supplied search term, so a note literally containing
// "%" or "_" (e.g. "commission 10%") is matched as text, not as a wildcard —
// paired with the `ESCAPE '\'` clause in ListTransactionsByUser.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

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
	if q.CategoryIDs != "" {
		parts := strings.Split(q.CategoryIDs, ",")
		categoryIDs := make([]uuid.UUID, 0, len(parts))
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			categoryID, err := uuid.Parse(part)
			if err != nil {
				return nil, nil, common.NewInvalidInputError("category_ids must be a comma-separated list of valid UUIDs")
			}
			if _, err := s.getVisibleCategory(ctx, userID, categoryID); err != nil {
				return nil, nil, err
			}
			categoryIDs = append(categoryIDs, categoryID)
		}
		if len(categoryIDs) > 0 {
			filter.CategoryIDs = categoryIDs
		}
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
	if search := strings.TrimSpace(q.Search); search != "" {
		escaped := likeEscaper.Replace(search)
		filter.Search = &escaped
	}
	if q.Cursor != "" {
		id, occurredAt, createdAt, err := decodeTransactionCursor(q.Cursor)
		if err != nil {
			return nil, nil, common.NewInvalidInputError("cursor is invalid")
		}
		filter.CursorID = &id
		filter.CursorOccurredAt = &occurredAt
		filter.CursorCreatedAt = &createdAt
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
		c, err := encodeTransactionCursor(last.ID, last.OccurredAt, last.CreatedAt)
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
