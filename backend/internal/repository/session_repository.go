package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// SessionRepository wraps the sessions sqlc queries. It holds no session
// policy (limits, grace windows, what counts as reuse) — that is
// service.SessionService's job.
type SessionRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewSessionRepository(q *sqlc.Queries, pool Beginner) *SessionRepository {
	return &SessionRepository{q: q, pool: pool}
}

// Create inserts a session after revoking the user's least recently used
// live sessions so that, counting the new one, at most maxActive remain. The
// user row is locked first, so two simultaneous sign-ins of one user queue
// instead of both seeing room. Returns pgx.ErrNoRows (wrapped) for an
// unknown or soft-deleted user.
func (r *SessionRepository) Create(ctx context.Context, s model.Session, maxActive int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository.CreateSession: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after Commit

	q := r.q.WithTx(tx)
	if _, err := q.LockUserForSession(ctx, s.UserID); err != nil {
		return fmt.Errorf("repository.CreateSession: lock user: %w", err)
	}
	if _, err := q.RevokeSessionsBeyondLimit(ctx, s.UserID, int64(maxActive-1)); err != nil {
		return fmt.Errorf("repository.CreateSession: enforce limit: %w", err)
	}
	if err := q.CreateSession(ctx, sqlc.CreateSessionParams{
		ID:                s.ID,
		UserID:            s.UserID,
		RefreshJTI:        s.RefreshJTI,
		ExpiresAt:         s.ExpiresAt,
		AbsoluteExpiresAt: s.AbsoluteExpiresAt,
	}); err != nil {
		return fmt.Errorf("repository.CreateSession: insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository.CreateSession: commit: %w", err)
	}
	return nil
}

// Get returns pgx.ErrNoRows (wrapped) when there is no such session.
func (r *SessionRepository) Get(ctx context.Context, id uuid.UUID) (*model.Session, error) {
	row, err := r.q.GetSession(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.GetSession: %w", err)
	}
	return &model.Session{
		ID:                row.ID,
		UserID:            row.UserID,
		RefreshJTI:        row.RefreshJTI,
		PrevRefreshJTI:    row.PrevRefreshJTI,
		RotatedAt:         row.RotatedAt,
		CreatedAt:         row.CreatedAt,
		LastUsedAt:        row.LastUsedAt,
		ExpiresAt:         row.ExpiresAt,
		AbsoluteExpiresAt: row.AbsoluteExpiresAt,
		RevokedAt:         row.RevokedAt,
		RevokedReason:     row.RevokedReason,
	}, nil
}

// Rotate swaps the session's current refresh jti for newJTI and moves its
// idle expiry. False means the current jti was no longer currentJTI (another
// refresh won) or the session is revoked.
func (r *SessionRepository) Rotate(ctx context.Context, id uuid.UUID, currentJTI, newJTI string, expiresAt time.Time) (bool, error) {
	n, err := r.q.RotateSessionRefresh(ctx, sqlc.RotateSessionRefreshParams{
		ID:         id,
		CurrentJTI: currentJTI,
		NewJTI:     newJTI,
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		return false, fmt.Errorf("repository.RotateSessionRefresh: %w", err)
	}
	return n > 0, nil
}

// Revoke ends one session of the user; false when it was already ended or
// is not theirs.
func (r *SessionRepository) Revoke(ctx context.Context, id, userID uuid.UUID, reason string) (bool, error) {
	n, err := r.q.RevokeSession(ctx, id, userID, reason)
	if err != nil {
		return false, fmt.Errorf("repository.RevokeSession: %w", err)
	}
	return n > 0, nil
}

func (r *SessionRepository) RevokeAllForUser(ctx context.Context, userID uuid.UUID, reason string) (int64, error) {
	n, err := r.q.RevokeAllSessionsForUser(ctx, userID, reason)
	if err != nil {
		return 0, fmt.Errorf("repository.RevokeAllSessionsForUser: %w", err)
	}
	return n, nil
}

// AuthState returns (nil, nil) when the session does not exist, is not this
// user's, or its user is gone — all of which mean "not authenticated".
func (r *SessionRepository) AuthState(ctx context.Context, id, userID uuid.UUID) (*model.SessionAuthState, error) {
	row, err := r.q.GetSessionAuthState(ctx, id, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository.GetSessionAuthState: %w", err)
	}
	return &model.SessionAuthState{
		RevokedAt:         row.RevokedAt,
		ExpiresAt:         row.ExpiresAt,
		AbsoluteExpiresAt: row.AbsoluteExpiresAt,
		UserStatus:        model.UserStatus(row.Status),
		UserRole:          model.UserRole(row.Role),
		TokensValidAfter:  row.TokensValidAfter,
	}, nil
}

// DeleteExpired removes sessions past their hard stop, or revoked, before
// cutoff (retention).
func (r *SessionRepository) DeleteExpired(ctx context.Context, cutoff time.Time) (int64, error) {
	n, err := r.q.DeleteExpiredSessions(ctx, cutoff)
	if err != nil {
		return 0, fmt.Errorf("repository.DeleteExpiredSessions: %w", err)
	}
	return n, nil
}
