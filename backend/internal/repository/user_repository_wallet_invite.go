package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Shared wallets, invited by email (specs/shared-wallets, 2026-10-29): a
// wallet owner's invitation to an address with no account creates the
// pending account in the invitation's own transaction, so neither exists
// without the other.

// CreatePendingUserTx is CreatePendingUser inside tx.
func (r *UserRepository) CreatePendingUserTx(ctx context.Context, tx pgx.Tx, email string, role model.UserRole, invitedBy uuid.UUID, inviteToken string) (*model.User, error) {
	row, err := r.q.WithTx(tx).CreatePendingUser(ctx, sqlc.CreatePendingUserParams{
		Email:       email,
		Role:        string(role),
		InvitedBy:   &invitedBy,
		InviteToken: inviteToken,
	})
	if err != nil {
		return nil, fmt.Errorf("repository.CreatePendingUserTx: %w", err)
	}
	return toModel(row), nil
}

// RefreshPendingInvite gives a never-activated account a fresh token and 72h,
// inside tx. pgx.ErrNoRows when the account is no longer pending.
func (r *UserRepository) RefreshPendingInvite(ctx context.Context, tx pgx.Tx, id uuid.UUID, inviteToken string) error {
	updated, err := r.q.WithTx(tx).RefreshPendingInvite(ctx, id, inviteToken)
	if err != nil {
		return fmt.Errorf("repository.RefreshPendingInvite: %w", err)
	}
	if updated == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
