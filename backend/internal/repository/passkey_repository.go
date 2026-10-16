package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// PasskeyRepository wraps the passkeys and passkey_challenges queries. It
// holds no WebAuthn logic — that is service.PasskeyService's job.
type PasskeyRepository struct {
	q *sqlc.Queries
}

func NewPasskeyRepository(q *sqlc.Queries) *PasskeyRepository {
	return &PasskeyRepository{q: q}
}

func toModelPasskey(p sqlc.Passkey) *model.Passkey {
	return &model.Passkey{
		ID: p.ID, UserID: p.UserID, CredentialID: p.CredentialID, Credential: p.Credential,
		Name: p.Name, CreatedAt: p.CreatedAt, LastUsedAt: p.LastUsedAt,
	}
}

func (r *PasskeyRepository) Create(ctx context.Context, userID uuid.UUID, credentialID, credential []byte, name string) (*model.Passkey, error) {
	p, err := r.q.CreatePasskey(ctx, sqlc.CreatePasskeyParams{UserID: userID, CredentialID: credentialID, Credential: credential, Name: name})
	if err != nil {
		return nil, fmt.Errorf("repository.CreatePasskey: %w", err)
	}
	return toModelPasskey(p), nil
}

func (r *PasskeyRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]*model.Passkey, error) {
	rows, err := r.q.ListPasskeysByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("repository.ListPasskeysByUser: %w", err)
	}
	out := make([]*model.Passkey, 0, len(rows))
	for _, p := range rows {
		out = append(out, toModelPasskey(p))
	}
	return out, nil
}

// GetByCredentialID returns pgx.ErrNoRows (wrapped) for an unknown credential.
func (r *PasskeyRepository) GetByCredentialID(ctx context.Context, credentialID []byte) (*model.Passkey, error) {
	p, err := r.q.GetPasskeyByCredentialID(ctx, credentialID)
	if err != nil {
		return nil, fmt.Errorf("repository.GetPasskeyByCredentialID: %w", err)
	}
	return toModelPasskey(p), nil
}

func (r *PasskeyRepository) CountByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	n, err := r.q.CountPasskeysByUser(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("repository.CountPasskeysByUser: %w", err)
	}
	return n, nil
}

func (r *PasskeyRepository) Touch(ctx context.Context, id, userID uuid.UUID, credential []byte) error {
	if err := r.q.TouchPasskey(ctx, id, userID, credential); err != nil {
		return fmt.Errorf("repository.TouchPasskey: %w", err)
	}
	return nil
}

// Delete soft-deletes one of the user's own passkeys; false when there was none.
func (r *PasskeyRepository) Delete(ctx context.Context, id, userID uuid.UUID) (bool, error) {
	n, err := r.q.SoftDeletePasskey(ctx, id, userID)
	if err != nil {
		return false, fmt.Errorf("repository.SoftDeletePasskey: %w", err)
	}
	return n > 0, nil
}

// CreateChallenge stores a ceremony's session data, first clearing out
// expired ones (a cheap indexed delete, so no separate cleanup job).
func (r *PasskeyRepository) CreateChallenge(ctx context.Context, userID *uuid.UUID, purpose model.PasskeyChallengePurpose, session []byte, expiresAt time.Time) (uuid.UUID, error) {
	if _, err := r.q.DeleteExpiredPasskeyChallenges(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("repository.CreatePasskeyChallenge: cleanup: %w", err)
	}
	id, err := r.q.CreatePasskeyChallenge(ctx, sqlc.CreatePasskeyChallengeParams{
		UserID: userID, Purpose: string(purpose), Session: session, ExpiresAt: expiresAt,
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("repository.CreatePasskeyChallenge: %w", err)
	}
	return id, nil
}

// ConsumeChallenge deletes and returns a live challenge; pgx.ErrNoRows
// (wrapped) when it is unknown, expired, already used, or for the other
// purpose.
func (r *PasskeyRepository) ConsumeChallenge(ctx context.Context, id uuid.UUID, purpose model.PasskeyChallengePurpose) (*uuid.UUID, []byte, error) {
	userID, session, err := r.q.ConsumePasskeyChallenge(ctx, id, string(purpose))
	if err != nil {
		return nil, nil, fmt.Errorf("repository.ConsumePasskeyChallenge: %w", err)
	}
	return userID, session, nil
}
