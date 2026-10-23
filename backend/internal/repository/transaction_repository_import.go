package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// ImportedKeyStates returns, for each of keys that already has one of the
// caller's Transactions, whether that Transaction is soft-deleted (true) or
// live (false). A key with no Transaction is absent from the map. One query
// for a whole import preview instead of one per row.
func (r *TransactionRepository) ImportedKeyStates(ctx context.Context, userID uuid.UUID, keys []uuid.UUID) (map[uuid.UUID]bool, error) {
	states := make(map[uuid.UUID]bool, len(keys))
	if len(keys) == 0 {
		return states, nil
	}
	rows, err := r.q.ListIdempotencyKeyStates(ctx, userID, keys)
	if err != nil {
		return nil, fmt.Errorf("repository.ImportedKeyStates: %w", err)
	}
	for _, row := range rows {
		states[row.IdempotencyKey] = row.Deleted
	}
	return states, nil
}
