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

// ListTransactionsResult is what ListTransactions hands back — plain values
// rather than a DTO, matching UserService.ListUsers's convention, grouped into
// a struct because a fourth bare return value stopped being readable.
type ListTransactionsResult struct {
	Transactions []*model.Transaction
	NextCursor   *string
	// Total rows matching the filters, or nil on any page but the first —
	// see the CountTransactionsByUser call below.
	Total *int64
}

// ListTransactions implements US-02 — strictly scoped to the caller
// (CLAUDE.md user isolation rule), cursor-paginated on occurred_at (not
// created_at, spec.md Edge Cases US-02 #1).
func (s *TransactionService) ListTransactions(ctx context.Context, userID uuid.UUID, q dto.ListTransactionsQuery) (ListTransactionsResult, error) {
	filter := repository.ListTransactionsFilter{}

	if q.WalletID != "" {
		walletID, err := uuid.Parse(q.WalletID)
		if err != nil {
			return ListTransactionsResult{}, common.NewInvalidInputError("wallet_id must be a valid UUID")
		}
		// Owner or any member: a wallet's own list shows every entry in it,
		// whoever recorded it (specs/shared-wallets US-04). Without a wallet
		// filter the list stays the caller's own entries (BR-09).
		if _, err := requireReadableWallet(ctx, s.walletRepo, userID, walletID); err != nil {
			return ListTransactionsResult{}, err
		}
		filter.WalletID = &walletID
		filter.WalletScoped = true
	}
	if q.CategoryID != "" {
		categoryID, err := uuid.Parse(q.CategoryID)
		if err != nil {
			return ListTransactionsResult{}, common.NewInvalidInputError("category_id must be a valid UUID")
		}
		if _, err := s.getVisibleCategory(ctx, userID, categoryID); err != nil {
			return ListTransactionsResult{}, err
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
				return ListTransactionsResult{}, common.NewInvalidInputError("category_ids must be a comma-separated list of valid UUIDs")
			}
			categoryIDs = append(categoryIDs, categoryID)
		}
		// One query for the whole list (it used to be one per id).
		if err := s.checkVisibleCategories(ctx, userID, categoryIDs); err != nil {
			return ListTransactionsResult{}, err
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
			return ListTransactionsResult{}, common.NewInvalidInputError("from must be a valid date or timestamp")
		}
		filter.From = &from
	}
	if q.To != "" {
		to, err := parseFlexibleTimestamp(q.To)
		if err != nil {
			return ListTransactionsResult{}, common.NewInvalidInputError("to must be a valid date or timestamp")
		}
		filter.To = &to
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		return ListTransactionsResult{}, common.NewInvalidInputError("from must not be after to")
	}
	if search := strings.TrimSpace(q.Search); search != "" {
		escaped := likeEscaper.Replace(search)
		filter.Search = &escaped
	}
	if q.Cursor != "" {
		id, occurredAt, createdAt, err := decodeTransactionCursor(q.Cursor)
		if err != nil {
			return ListTransactionsResult{}, common.NewInvalidInputError("cursor is invalid")
		}
		filter.CursorID = &id
		filter.CursorOccurredAt = &occurredAt
		filter.CursorCreatedAt = &createdAt
	}

	limit := q.Limit
	if limit == 0 {
		limit = common.DefaultListLimit
	}
	// Fetch one extra row to know whether a next page exists (same convention
	// as UserService.ListUsers) — cheaper than deriving hasMore from `total`,
	// and it keeps paging correct even on the pages that skip the count.
	filter.Limit = int32(limit + 1)

	transactions, err := s.repo.ListTransactionsByUser(ctx, userID, filter)
	if err != nil {
		return ListTransactionsResult{}, fmt.Errorf("service.ListTransactions: %w", err)
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
			return ListTransactionsResult{}, fmt.Errorf("service.ListTransactions: %w", err)
		}
		nextCursor = &c
	}

	// Counted on the first page only. The number describes the filters, which
	// don't change as the client pages through them, so re-running a COUNT for
	// every scroll-triggered fetch would buy nothing — the client holds the
	// value it got with page one.
	var total *int64
	if q.Cursor == "" {
		count, err := s.repo.CountTransactionsByUser(ctx, userID, filter)
		if err != nil {
			return ListTransactionsResult{}, fmt.Errorf("service.ListTransactions: %w", err)
		}
		total = &count
	}

	if err := s.attachItemCounts(ctx, userID, transactions); err != nil {
		return ListTransactionsResult{}, err
	}
	if filter.WalletScoped {
		if err := s.attachRecorderNames(ctx, userID, transactions); err != nil {
			return ListTransactionsResult{}, err
		}
	}

	return ListTransactionsResult{Transactions: transactions, NextCursor: nextCursor, Total: total}, nil
}

// attachItemCounts sets ItemCount on a page of rows with one batched query
// per recorder (specs/transaction-line-items plan F4) — never one per row.
// The count query is scoped by recorder; a shared wallet's page holds
// several (specs/shared-wallets), usually one to three. The ids all come
// from a page the caller was allowed to read.
func (s *TransactionService) attachItemCounts(ctx context.Context, userID uuid.UUID, transactions []*model.Transaction) error {
	idsByRecorder := map[uuid.UUID][]uuid.UUID{userID: nil}
	for _, t := range transactions {
		idsByRecorder[t.UserID] = append(idsByRecorder[t.UserID], t.ID)
	}
	counts := make(map[uuid.UUID]int, len(transactions))
	for recorder, ids := range idsByRecorder {
		if len(ids) == 0 {
			continue
		}
		recorderCounts, err := s.repo.CountActiveItems(ctx, recorder, ids)
		if err != nil {
			return fmt.Errorf("service.ListTransactions: %w", err)
		}
		for id, n := range recorderCounts {
			counts[id] = n
		}
	}
	for _, t := range transactions {
		t.ItemCount = counts[t.ID]
	}
	return nil
}

// attachRecorderNames names whoever recorded each entry on a shared wallet's
// page, when that is not the caller (specs/shared-wallets BR-13): one batched
// lookup per page.
func (s *TransactionService) attachRecorderNames(ctx context.Context, userID uuid.UUID, transactions []*model.Transaction) error {
	seen := make(map[uuid.UUID]bool)
	ids := make([]uuid.UUID, 0)
	for _, t := range transactions {
		if t.UserID != userID && !seen[t.UserID] {
			seen[t.UserID] = true
			ids = append(ids, t.UserID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	names, err := s.walletRepo.ListUserDisplayNames(ctx, ids)
	if err != nil {
		return fmt.Errorf("service.ListTransactions: %w", err)
	}
	for _, t := range transactions {
		if name, ok := names[t.UserID]; ok && t.UserID != userID {
			recorded := name
			t.RecordedByName = &recorded
		}
	}
	return nil
}

// GetTransaction implements US-03 — distinguishes "belongs to someone else"
// (403) from "doesn't exist" (404), per spec.md S-TRX-32/S-TRX-33.
// Ownership is settled before any line is read (specs/transaction-line-items
// BR-13). Non-transactional read.
func (s *TransactionService) GetTransaction(ctx context.Context, userID, transactionID uuid.UUID) (*model.Transaction, error) {
	transaction, err := s.getOwnedTransaction(ctx, userID, transactionID)
	if err != nil {
		return nil, err
	}
	lines, err := s.repo.ListActiveLines(ctx, nil, transactionID, userID)
	if err != nil {
		return nil, fmt.Errorf("service.GetTransaction: %w", err)
	}
	attachLines(transaction, lines)
	return transaction, nil
}
