package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// SearchUsers backs the account deletion tool's search box. pattern must be
// lowercased with LIKE wildcards escaped (the service does both).
func (r *UserRepository) SearchUsers(ctx context.Context, pattern string, limit int32) ([]*model.User, error) {
	rows, err := r.q.SearchUsers(ctx, pattern, limit)
	if err != nil {
		return nil, fmt.Errorf("repository.SearchUsers: %w", err)
	}
	users := make([]*model.User, 0, len(rows))
	for _, row := range rows {
		users = append(users, toModel(row))
	}
	return users, nil
}

// SoftDeleteUser marks a live account deleted. Returns pgx.ErrNoRows
// (wrapped) when it is unknown or already deleted.
func (r *UserRepository) SoftDeleteUser(ctx context.Context, id uuid.UUID) (*model.User, error) {
	row, err := r.q.SoftDeleteUser(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.SoftDeleteUser: %w", err)
	}
	return toModel(row), nil
}
