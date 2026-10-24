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

// PasswordResetRepository stores forgot-password codes (migration 036). It
// holds no policy (lifetimes, caps, tries): service.PasswordResetService
// passes those in.
type PasswordResetRepository struct {
	q    *sqlc.Queries
	pool Beginner
}

func NewPasswordResetRepository(q *sqlc.Queries, pool Beginner) *PasswordResetRepository {
	return &PasswordResetRepository{q: q, pool: pool}
}

// NewCode is one code to store and the caps it must pass first.
type NewCode struct {
	UserID    uuid.UUID
	CodeHash  string
	ExpiresAt time.Time
	// No other code created after CooldownSince, and fewer than HourlyMax
	// created after HourSince.
	CooldownSince time.Time
	HourSince     time.Time
	HourlyMax     int64
}

// CreateCode stores c and ends the user's older live codes, in one
// transaction that first locks the user row, so two requests at once cannot
// both pass the caps. created=false: the user is not an active account, or a
// cap holds; nothing was written.
func (r *PasswordResetRepository) CreateCode(ctx context.Context, c NewCode) (created bool, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after Commit

	q := r.q.WithTx(tx)
	if _, err := q.LockActiveUserForPasswordReset(ctx, c.UserID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("repository.CreateResetCode: lock user: %w", err)
	}
	recent, err := q.CountPasswordResetCodesSince(ctx, c.UserID, c.CooldownSince)
	if err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: cooldown: %w", err)
	}
	inHour, err := q.CountPasswordResetCodesSince(ctx, c.UserID, c.HourSince)
	if err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: hourly cap: %w", err)
	}
	if recent > 0 || inHour >= c.HourlyMax {
		return false, nil
	}
	if err := q.RevokeLivePasswordResetCodes(ctx, c.UserID); err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: revoke older: %w", err)
	}
	if err := q.CreatePasswordResetCode(ctx, c.UserID, c.CodeHash, c.ExpiresAt); err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("repository.CreateResetCode: commit: %w", err)
	}
	return true, nil
}

// LiveCode returns the user's newest live code, or pgx.ErrNoRows (wrapped).
func (r *PasswordResetRepository) LiveCode(ctx context.Context, userID uuid.UUID) (*model.PasswordResetCode, error) {
	row, err := r.q.GetLivePasswordResetCode(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.LiveResetCode: %w", err)
	}
	return &model.PasswordResetCode{
		ID: row.ID, UserID: row.UserID, CodeHash: row.CodeHash, Attempts: row.Attempts,
		CreatedAt: row.CreatedAt, ExpiresAt: row.ExpiresAt, UsedAt: row.UsedAt, RevokedAt: row.RevokedAt,
	}, nil
}

// SpendTry counts one wrong try against a code, ending it at maxTries.
func (r *PasswordResetRepository) SpendTry(ctx context.Context, codeID uuid.UUID, maxTries int32) error {
	if err := r.q.SpendPasswordResetTry(ctx, codeID, maxTries); err != nil {
		return fmt.Errorf("repository.SpendResetTry: %w", err)
	}
	return nil
}

// ResetPassword uses the code and stores the new hash with the user's new
// sign-out point, in one transaction: both conditional updates take effect or
// neither does. false = the code is no longer live (a concurrent confirm used
// it) or the user is no longer active.
func (r *PasswordResetRepository) ResetPassword(ctx context.Context, codeID, userID uuid.UUID, maxTries int32, passwordHash string, signOutAt time.Time) (bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("repository.ResetPassword: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after Commit

	q := r.q.WithTx(tx)
	used, err := q.UsePasswordResetCode(ctx, codeID, userID, maxTries)
	if err != nil {
		return false, fmt.Errorf("repository.ResetPassword: use code: %w", err)
	}
	if used == 0 {
		return false, nil
	}
	changed, err := q.ChangeUserPassword(ctx, userID, passwordHash, signOutAt)
	if err != nil {
		return false, fmt.Errorf("repository.ResetPassword: change password: %w", err)
	}
	if changed == 0 {
		return false, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("repository.ResetPassword: commit: %w", err)
	}
	return true, nil
}

// DeleteExpired removes codes created before cutoff (retention, BR-10);
// satisfies service.ExpiredPurger.
func (r *PasswordResetRepository) DeleteExpired(ctx context.Context, cutoff time.Time) (int64, error) {
	n, err := r.q.DeleteOldPasswordResetCodes(ctx, cutoff)
	if err != nil {
		return 0, fmt.Errorf("repository.DeleteOldResetCodes: %w", err)
	}
	return n, nil
}
