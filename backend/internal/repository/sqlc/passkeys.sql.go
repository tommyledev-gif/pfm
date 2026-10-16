package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Passkey mirrors the passkeys table's live columns (032_passkeys.sql).
// Credential is go-webauthn's Credential record as raw JSONB bytes.
type Passkey struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	CredentialID []byte
	Credential   []byte
	Name         string
	CreatedAt    time.Time
	LastUsedAt   *time.Time
}

func scanPasskey(row interface{ Scan(dest ...any) error }) (Passkey, error) {
	var p Passkey
	err := row.Scan(&p.ID, &p.UserID, &p.CredentialID, &p.Credential, &p.Name, &p.CreatedAt, &p.LastUsedAt)
	return p, err
}

const createPasskey = `-- name: CreatePasskey :one
INSERT INTO passkeys (user_id, credential_id, credential, name)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, credential_id, credential, name, created_at, last_used_at
`

type CreatePasskeyParams struct {
	UserID       uuid.UUID
	CredentialID []byte
	Credential   []byte
	Name         string
}

func (q *Queries) CreatePasskey(ctx context.Context, arg CreatePasskeyParams) (Passkey, error) {
	return scanPasskey(q.db.QueryRow(ctx, createPasskey, arg.UserID, arg.CredentialID, arg.Credential, arg.Name))
}

const listPasskeysByUser = `-- name: ListPasskeysByUser :many
SELECT id, user_id, credential_id, credential, name, created_at, last_used_at
FROM passkeys
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
`

func (q *Queries) ListPasskeysByUser(ctx context.Context, userID uuid.UUID) ([]Passkey, error) {
	rows, err := q.db.Query(ctx, listPasskeysByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Passkey
	for rows.Next() {
		p, err := scanPasskey(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

const getPasskeyByCredentialID = `-- name: GetPasskeyByCredentialID :one
SELECT p.id, p.user_id, p.credential_id, p.credential, p.name, p.created_at, p.last_used_at
FROM passkeys p
JOIN users u ON u.id = p.user_id
WHERE p.credential_id = $1
  AND p.deleted_at IS NULL
  AND u.deleted_at IS NULL
`

// GetPasskeyByCredentialID returns pgx.ErrNoRows for an unknown, deleted, or
// deleted-user credential.
func (q *Queries) GetPasskeyByCredentialID(ctx context.Context, credentialID []byte) (Passkey, error) {
	return scanPasskey(q.db.QueryRow(ctx, getPasskeyByCredentialID, credentialID))
}

const countPasskeysByUser = `-- name: CountPasskeysByUser :one
SELECT COUNT(*) FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL
`

func (q *Queries) CountPasskeysByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countPasskeysByUser, userID).Scan(&n)
	return n, err
}

const touchPasskey = `-- name: TouchPasskey :exec
UPDATE passkeys
SET credential = $3, last_used_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
`

// TouchPasskey stores the credential as it stands after a sign-in (its sign
// counter and flags move) and when it was used.
func (q *Queries) TouchPasskey(ctx context.Context, id, userID uuid.UUID, credential []byte) error {
	_, err := q.db.Exec(ctx, touchPasskey, id, userID, credential)
	return err
}

const softDeletePasskey = `-- name: SoftDeletePasskey :execrows
UPDATE passkeys
SET deleted_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
`

func (q *Queries) SoftDeletePasskey(ctx context.Context, id, userID uuid.UUID) (int64, error) {
	result, err := q.db.Exec(ctx, softDeletePasskey, id, userID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const createPasskeyChallenge = `-- name: CreatePasskeyChallenge :one
INSERT INTO passkey_challenges (user_id, purpose, session, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id
`

type CreatePasskeyChallengeParams struct {
	UserID    *uuid.UUID
	Purpose   string
	Session   []byte
	ExpiresAt time.Time
}

func (q *Queries) CreatePasskeyChallenge(ctx context.Context, arg CreatePasskeyChallengeParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, createPasskeyChallenge, arg.UserID, arg.Purpose, arg.Session, arg.ExpiresAt).Scan(&id)
	return id, err
}

const consumePasskeyChallenge = `-- name: ConsumePasskeyChallenge :one
DELETE FROM passkey_challenges
WHERE id = $1
  AND purpose = $2
  AND expires_at > NOW()
RETURNING user_id, session
`

// ConsumePasskeyChallenge deletes and returns a live challenge — the delete is
// what makes it single-use. pgx.ErrNoRows for unknown, expired or used.
func (q *Queries) ConsumePasskeyChallenge(ctx context.Context, id uuid.UUID, purpose string) (*uuid.UUID, []byte, error) {
	var userID *uuid.UUID
	var session []byte
	err := q.db.QueryRow(ctx, consumePasskeyChallenge, id, purpose).Scan(&userID, &session)
	return userID, session, err
}

const deleteExpiredPasskeyChallenges = `-- name: DeleteExpiredPasskeyChallenges :execrows
DELETE FROM passkey_challenges WHERE expires_at <= NOW()
`

func (q *Queries) DeleteExpiredPasskeyChallenges(ctx context.Context) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredPasskeyChallenges)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
