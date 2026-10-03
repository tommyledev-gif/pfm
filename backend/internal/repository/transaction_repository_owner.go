package repository

import (
	"context"

	"github.com/google/uuid"
)

// GetTransactionOwnerIncludingDeleted returns the owner of a Transaction
// whether or not it has been soft-deleted, or pgx.ErrNoRows when the id never
// existed. Used only to authorize reading its audit history
// (specs/mobile-ux-batch-2026-10 US-13) — split from transaction_repository.go
// to keep that file under the 300-line limit.
func (r *TransactionRepository) GetTransactionOwnerIncludingDeleted(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	return r.q.GetTransactionOwnerIncludingDeleted(ctx, id)
}
