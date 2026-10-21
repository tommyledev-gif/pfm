package service

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeTransactionRepo's list/count queries, split from
// fake_transaction_repo_test.go to keep that file under the 300-line limit.

// ListTransactionsByUser applies every filter and the occurred_at-keyed
// cursor tie-break in plain Go, mirroring the real SQL WHERE clause
// (db/queries/transactions.sql) closely enough for these tests' purposes.
func (f *fakeTransactionRepo) ListTransactionsByUser(_ context.Context, userID uuid.UUID, filter repository.ListTransactionsFilter) ([]*model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []*model.Transaction
	for _, t := range f.transactions {
		// Mirrors the SQL: WalletScoped lifts the user filter, but only
		// together with a wallet filter (specs/shared-wallets plan F1).
		walletScoped := filter.WalletScoped && filter.WalletID != nil
		if t.DeletedAt != nil || (t.UserID != userID && !walletScoped) {
			continue
		}
		if filter.WalletID != nil && t.WalletID != *filter.WalletID && (t.ToWalletID == nil || *t.ToWalletID != *filter.WalletID) {
			continue
		}
		if filter.CategoryID != nil && t.CategoryID != *filter.CategoryID {
			continue
		}
		if len(filter.CategoryIDs) > 0 {
			matched := false
			for _, id := range filter.CategoryIDs {
				if t.CategoryID == id {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		if filter.Type != nil && string(t.Type) != *filter.Type {
			continue
		}
		if filter.From != nil && t.OccurredAt.Before(*filter.From) {
			continue
		}
		if filter.To != nil && t.OccurredAt.After(*filter.To) {
			continue
		}
		if filter.Search != nil {
			note := ""
			if t.Note != nil {
				note = *t.Note
			}
			if !strings.Contains(strings.ToLower(note), strings.ToLower(*filter.Search)) {
				continue
			}
		}
		if filter.CursorOccurredAt != nil {
			cursorOccurredAt := *filter.CursorOccurredAt
			cursorCreatedAt := time.Time{}
			if filter.CursorCreatedAt != nil {
				cursorCreatedAt = *filter.CursorCreatedAt
			}
			before := t.OccurredAt.Before(cursorOccurredAt)
			tie1 := t.OccurredAt.Equal(cursorOccurredAt) && t.CreatedAt.Before(cursorCreatedAt)
			tie2 := t.OccurredAt.Equal(cursorOccurredAt) && t.CreatedAt.Equal(cursorCreatedAt) &&
				filter.CursorID != nil && t.ID.String() < filter.CursorID.String()
			if !(before || tie1 || tie2) {
				continue
			}
		}
		cp := *t
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].OccurredAt.Equal(out[j].OccurredAt) {
			return out[i].OccurredAt.After(out[j].OccurredAt)
		}
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].ID.String() > out[j].ID.String()
	})
	limit := int(filter.Limit)
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// CountTransactionsByUser mirrors the real query's relationship to
// ListTransactionsByUser — the same filters with the cursor and limit
// stripped — by delegating rather than restating the filter logic, so the two
// can't drift apart in the fake the way they could in hand-copied code.
func (f *fakeTransactionRepo) CountTransactionsByUser(ctx context.Context, userID uuid.UUID, filter repository.ListTransactionsFilter) (int64, error) {
	unpaged := filter
	unpaged.CursorOccurredAt = nil
	unpaged.CursorCreatedAt = nil
	unpaged.CursorID = nil
	unpaged.Limit = 0

	rows, err := f.ListTransactionsByUser(ctx, userID, unpaged)
	if err != nil {
		return 0, err
	}
	return int64(len(rows)), nil
}
