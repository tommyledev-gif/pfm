package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ChangePassword stores a new bcrypt hash and moves tokens_valid_after to
// signOutAt in one statement. False when the user is unknown, soft-deleted or
// no longer active.
func (r *UserRepository) ChangePassword(ctx context.Context, id uuid.UUID, passwordHash string, signOutAt time.Time) (bool, error) {
	affected, err := r.q.ChangeUserPassword(ctx, id, passwordHash, signOutAt)
	if err != nil {
		return false, fmt.Errorf("repository.ChangePassword: %w", err)
	}
	return affected > 0, nil
}
