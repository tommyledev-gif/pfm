package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const listIdempotencyKeyStates = `-- name: ListIdempotencyKeyStates :many
SELECT idempotency_key, deleted_at IS NOT NULL AS deleted
FROM transactions
WHERE user_id = $1
  AND idempotency_key = ANY($2::uuid[])
`

// IdempotencyKeyState is one of the caller's keys that already has a
// Transaction, and whether that Transaction has since been soft-deleted.
type IdempotencyKeyState struct {
	IdempotencyKey uuid.UUID
	Deleted        bool
}

// ListIdempotencyKeyStates answers "which of these keys exist already" for a
// whole import preview in one query, served by
// idx_transactions_user_idempotency_key. Not filtered by deleted_at, like
// GetTransactionByIdempotencyKey.
func (q *Queries) ListIdempotencyKeyStates(ctx context.Context, userID uuid.UUID, keys []uuid.UUID) ([]IdempotencyKeyState, error) {
	rows, err := q.db.Query(ctx, listIdempotencyKeyStates, userID, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []IdempotencyKeyState
	for rows.Next() {
		var i IdempotencyKeyState
		if err := rows.Scan(&i.IdempotencyKey, &i.Deleted); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
