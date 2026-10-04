package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// RevokedTokenRepository wraps the revoked_tokens sqlc queries.
type RevokedTokenRepository struct {
	q *sqlc.Queries
}

func NewRevokedTokenRepository(q *sqlc.Queries) *RevokedTokenRepository {
	return &RevokedTokenRepository{q: q}
}

// Revoke is a conflict-safe upsert (INSERT ... ON CONFLICT DO NOTHING) — safe
// to call for an already-revoked or already-expired token; both are treated
// as a successful no-op by design (spec.md S-SEC-09/S-SEC-11).
func (r *RevokedTokenRepository) Revoke(ctx context.Context, tokenJTI string, userID *uuid.UUID, expiresAt time.Time) error {
	if err := r.q.RevokeToken(ctx, sqlc.RevokeTokenParams{
		TokenJTI:  tokenJTI,
		UserID:    userID,
		ExpiresAt: expiresAt,
	}); err != nil {
		return fmt.Errorf("repository.RevokeToken: %w", err)
	}
	return nil
}

func (r *RevokedTokenRepository) IsRevoked(ctx context.Context, tokenJTI string) (bool, error) {
	revoked, err := r.q.IsTokenRevoked(ctx, tokenJTI)
	if err != nil {
		return false, fmt.Errorf("repository.IsTokenRevoked: %w", err)
	}
	return revoked, nil
}

// Claim records the jti and reports whether THIS call recorded it. Only one
// of several concurrent callers can ever get true (UNIQUE token_jti), which
// is what makes a switch token single-use (account-switch Finding #5).
func (r *RevokedTokenRepository) Claim(ctx context.Context, tokenJTI string, userID *uuid.UUID, expiresAt time.Time) (bool, error) {
	affected, err := r.q.ClaimTokenJTI(ctx, sqlc.RevokeTokenParams{
		TokenJTI:  tokenJTI,
		UserID:    userID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return false, fmt.Errorf("repository.ClaimTokenJTI: %w", err)
	}
	return affected > 0, nil
}
