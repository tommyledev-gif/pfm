package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// GetTransactionOwnerIncludingDeleted mirrors the real query: soft-deleted
// rows still resolve, only an unknown id is pgx.ErrNoRows.
func (f *fakeTransactionRepo) GetTransactionOwnerIncludingDeleted(_ context.Context, id uuid.UUID) (uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	t, ok := f.transactions[id]
	if !ok {
		return uuid.Nil, pgx.ErrNoRows
	}
	return t.UserID, nil
}
