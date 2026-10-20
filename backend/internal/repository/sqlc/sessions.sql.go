package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Session mirrors the sessions table (028_sessions.sql, device columns from
// 033_session_devices.sql; public_key is reserved and not read).
type Session struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	RefreshJTI        string
	PrevRefreshJTI    *string
	RotatedAt         *time.Time
	CreatedAt         time.Time
	LastUsedAt        time.Time
	ExpiresAt         time.Time
	AbsoluteExpiresAt time.Time
	RevokedAt         *time.Time
	RevokedReason     *string
	DeviceID          *uuid.UUID
	DeviceName        *string
}

const lockUserForSession = `-- name: LockUserForSession :one
SELECT id FROM users
WHERE id = $1
  AND deleted_at IS NULL
FOR NO KEY UPDATE
`

// LockUserForSession returns pgx.ErrNoRows for an unknown or soft-deleted user.
func (q *Queries) LockUserForSession(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	row := q.db.QueryRow(ctx, lockUserForSession, userID)
	var id uuid.UUID
	err := row.Scan(&id)
	return id, err
}

const revokeSessionsBeyondLimit = `-- name: RevokeSessionsBeyondLimit :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'session_limit'
WHERE id IN (
    SELECT s.id
    FROM sessions s
    WHERE s.user_id = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND s.absolute_expires_at > NOW()
    ORDER BY s.last_used_at DESC, s.created_at DESC, s.id
    OFFSET $2
)
`

// RevokeSessionsBeyondLimit keeps the keep most recently used live sessions
// of the user and revokes the rest.
func (q *Queries) RevokeSessionsBeyondLimit(ctx context.Context, userID uuid.UUID, keep int64) (int64, error) {
	result, err := q.db.Exec(ctx, revokeSessionsBeyondLimit, userID, keep)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const revokeSessionsOnDevice = `-- name: RevokeSessionsOnDevice :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'replaced'
WHERE user_id = $1
  AND device_id = $2
  AND revoked_at IS NULL
`

// RevokeSessionsOnDevice ends the user's live sessions on one device, so a
// new sign-in there replaces them.
func (q *Queries) RevokeSessionsOnDevice(ctx context.Context, userID, deviceID uuid.UUID) (int64, error) {
	result, err := q.db.Exec(ctx, revokeSessionsOnDevice, userID, deviceID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const createSession = `-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, refresh_jti, expires_at, absolute_expires_at, device_id, device_name)
VALUES ($1, $2, $3, $4, $5, $6, $7)
`

type CreateSessionParams struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	RefreshJTI        string
	ExpiresAt         time.Time
	AbsoluteExpiresAt time.Time
	DeviceID          *uuid.UUID
	DeviceName        *string
}

func (q *Queries) CreateSession(ctx context.Context, arg CreateSessionParams) error {
	_, err := q.db.Exec(ctx, createSession, arg.ID, arg.UserID, arg.RefreshJTI, arg.ExpiresAt, arg.AbsoluteExpiresAt, arg.DeviceID, arg.DeviceName)
	return err
}

const getSession = `-- name: GetSession :one
SELECT id, user_id, refresh_jti, prev_refresh_jti, rotated_at, created_at,
       last_used_at, expires_at, absolute_expires_at, revoked_at, revoked_reason,
       device_id, device_name
FROM sessions
WHERE id = $1
`

// GetSession returns pgx.ErrNoRows when there is no such session.
func (q *Queries) GetSession(ctx context.Context, id uuid.UUID) (Session, error) {
	row := q.db.QueryRow(ctx, getSession, id)
	var s Session
	err := row.Scan(
		&s.ID, &s.UserID, &s.RefreshJTI, &s.PrevRefreshJTI, &s.RotatedAt, &s.CreatedAt,
		&s.LastUsedAt, &s.ExpiresAt, &s.AbsoluteExpiresAt, &s.RevokedAt, &s.RevokedReason,
		&s.DeviceID, &s.DeviceName,
	)
	return s, err
}

const rotateSessionRefresh = `-- name: RotateSessionRefresh :execrows
UPDATE sessions
SET prev_refresh_jti = refresh_jti,
    refresh_jti      = $3,
    rotated_at       = NOW(),
    last_used_at     = NOW(),
    expires_at       = $4,
    device_id        = COALESCE(device_id, $5),
    device_name      = COALESCE(device_name, $6)
WHERE id = $1
  AND refresh_jti = $2
  AND revoked_at IS NULL
`

type RotateSessionRefreshParams struct {
	ID         uuid.UUID
	CurrentJTI string
	NewJTI     string
	ExpiresAt  time.Time
	// DeviceID/DeviceName fill a session that has no device yet; nil keeps
	// whatever is stored.
	DeviceID   *uuid.UUID
	DeviceName *string
}

// RotateSessionRefresh returns 1 when this call rotated the session, 0 when
// the current jti was no longer the presented one (lost a race) or the
// session is revoked.
func (q *Queries) RotateSessionRefresh(ctx context.Context, arg RotateSessionRefreshParams) (int64, error) {
	result, err := q.db.Exec(ctx, rotateSessionRefresh, arg.ID, arg.CurrentJTI, arg.NewJTI, arg.ExpiresAt, arg.DeviceID, arg.DeviceName)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const revokeUnboundSessions = `-- name: RevokeUnboundSessions :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = 'unbound_stale'
WHERE user_id = $1
  AND device_id IS NULL
  AND revoked_at IS NULL
  AND last_used_at < $2
`

func (q *Queries) RevokeUnboundSessions(ctx context.Context, userID uuid.UUID, lastUsedBefore time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, revokeUnboundSessions, userID, lastUsedBefore)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const revokeSession = `-- name: RevokeSession :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = $3
WHERE id = $1
  AND user_id = $2
  AND revoked_at IS NULL
`

func (q *Queries) RevokeSession(ctx context.Context, id, userID uuid.UUID, reason string) (int64, error) {
	result, err := q.db.Exec(ctx, revokeSession, id, userID, reason)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const listLiveSessionsForUser = `-- name: ListLiveSessionsForUser :many
SELECT id, device_name, created_at, last_used_at
FROM sessions
WHERE user_id = $1
  AND revoked_at IS NULL
  AND expires_at > NOW()
  AND absolute_expires_at > NOW()
ORDER BY last_used_at DESC, created_at DESC, id
`

type ListLiveSessionsForUserRow struct {
	ID         uuid.UUID
	DeviceName *string
	CreatedAt  time.Time
	LastUsedAt time.Time
}

// ListLiveSessionsForUser returns the user's usable sessions, most recently
// used first.
func (q *Queries) ListLiveSessionsForUser(ctx context.Context, userID uuid.UUID) ([]ListLiveSessionsForUserRow, error) {
	rows, err := q.db.Query(ctx, listLiveSessionsForUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListLiveSessionsForUserRow
	for rows.Next() {
		var r ListLiveSessionsForUserRow
		if err := rows.Scan(&r.ID, &r.DeviceName, &r.CreatedAt, &r.LastUsedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

const revokeAllSessionsForUser = `-- name: RevokeAllSessionsForUser :execrows
UPDATE sessions
SET revoked_at     = NOW(),
    revoked_reason = $2
WHERE user_id = $1
  AND revoked_at IS NULL
`

func (q *Queries) RevokeAllSessionsForUser(ctx context.Context, userID uuid.UUID, reason string) (int64, error) {
	result, err := q.db.Exec(ctx, revokeAllSessionsForUser, userID, reason)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const getSessionAuthState = `-- name: GetSessionAuthState :one
SELECT s.revoked_at, s.expires_at, s.absolute_expires_at,
       u.status, u.role, u.tokens_valid_after
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = $1
  AND s.user_id = $2
  AND u.deleted_at IS NULL
`

type GetSessionAuthStateRow struct {
	RevokedAt         *time.Time
	ExpiresAt         time.Time
	AbsoluteExpiresAt time.Time
	Status            string
	Role              string
	TokensValidAfter  *time.Time
}

// GetSessionAuthState returns pgx.ErrNoRows when the session does not exist,
// belongs to another user, or its user is soft-deleted.
func (q *Queries) GetSessionAuthState(ctx context.Context, id, userID uuid.UUID) (GetSessionAuthStateRow, error) {
	row := q.db.QueryRow(ctx, getSessionAuthState, id, userID)
	var r GetSessionAuthStateRow
	err := row.Scan(&r.RevokedAt, &r.ExpiresAt, &r.AbsoluteExpiresAt, &r.Status, &r.Role, &r.TokensValidAfter)
	return r, err
}

const deleteExpiredSessions = `-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions
WHERE absolute_expires_at < $1
   OR (revoked_at IS NOT NULL AND revoked_at < $1)
`

func (q *Queries) DeleteExpiredSessions(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredSessions, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const deleteExpiredRevokedTokens = `-- name: DeleteExpiredRevokedTokens :execrows
DELETE FROM revoked_tokens
WHERE expires_at < $1
`

func (q *Queries) DeleteExpiredRevokedTokens(ctx context.Context, cutoff time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, deleteExpiredRevokedTokens, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

const getMigrationAppliedAt = `-- name: GetMigrationAppliedAt :one
SELECT applied_at FROM schema_migrations
WHERE filename = $1
`

// GetMigrationAppliedAt reads cmd/migrate's ledger. pgx.ErrNoRows when the
// migration was never recorded; a "relation does not exist" error when the
// ledger itself is missing.
func (q *Queries) GetMigrationAppliedAt(ctx context.Context, filename string) (time.Time, error) {
	row := q.db.QueryRow(ctx, getMigrationAppliedAt, filename)
	var appliedAt time.Time
	err := row.Scan(&appliedAt)
	return appliedAt, err
}

const releaseTokenJTI = `-- name: ReleaseTokenJTI :execrows
DELETE FROM revoked_tokens
WHERE token_jti = $1
`

// ReleaseTokenJTI undoes ClaimTokenJTI for a token whose redemption failed
// after the claim, so the client may present it again.
func (q *Queries) ReleaseTokenJTI(ctx context.Context, tokenJTI string) (int64, error) {
	result, err := q.db.Exec(ctx, releaseTokenJTI, tokenJTI)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
