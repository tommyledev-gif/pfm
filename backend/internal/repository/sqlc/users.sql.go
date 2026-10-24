package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const createPendingUser = `-- name: CreatePendingUser :one
INSERT INTO users (email, role, invited_by, invite_token, invite_expires_at, invite_sent_at)
VALUES ($1, $2, $3, $4, NOW() + INTERVAL '72 hours', NOW())
RETURNING id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count
`

type CreatePendingUserParams struct {
	Email       string
	Role        string
	InvitedBy   *uuid.UUID
	InviteToken string
}

func (q *Queries) CreatePendingUser(ctx context.Context, arg CreatePendingUserParams) (User, error) {
	row := q.db.QueryRow(ctx, createPendingUser, arg.Email, arg.Role, arg.InvitedBy, arg.InviteToken)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
	)
	return i, err
}

const getUserByInviteToken = `-- name: GetUserByInviteToken :one
SELECT id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count FROM users
WHERE invite_token = $1
  AND status = 'pending'
  AND deleted_at IS NULL
LIMIT 1
`

func (q *Queries) GetUserByInviteToken(ctx context.Context, inviteToken string) (User, error) {
	row := q.db.QueryRow(ctx, getUserByInviteToken, inviteToken)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
	)
	return i, err
}

const activateUser = `-- name: ActivateUser :one
UPDATE users
SET
    full_name         = $2,
    password_hash     = $3,
    username          = $4,
    status            = 'active',
    invite_token      = NULL,
    invite_expires_at = NULL,
    activated_at      = NOW(),
    updated_at        = NOW()
WHERE invite_token = $1
  AND status = 'pending'
  AND invite_expires_at > NOW()
RETURNING id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count, username
`

type ActivateUserParams struct {
	InviteToken  string
	FullName     *string
	PasswordHash string
	Username     string
}

// ActivateUser returns pgx.ErrNoRows (via QueryRow.Scan) when the WHERE
// clause matched zero rows — that's the signal for "token invalid, already
// consumed, or expired" and is how the race in test_cases.md TC-USR-26 (only
// one of two concurrent activations succeeds) resolves without extra locking.
func (q *Queries) ActivateUser(ctx context.Context, arg ActivateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, activateUser, arg.InviteToken, arg.FullName, arg.PasswordHash, arg.Username)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
		&i.Username,
	)
	return i, err
}

const resendInvite = `-- name: ResendInvite :one
UPDATE users
SET
    invite_token        = $2,
    invite_expires_at   = NOW() + INTERVAL '72 hours',
    invite_sent_at      = NOW(),
    invite_resend_count = invite_resend_count + 1,
    updated_at          = NOW()
WHERE id = $1
  AND status = 'pending'
  AND deleted_at IS NULL
  AND invite_resend_count = $3
RETURNING id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count
`

type ResendInviteParams struct {
	ID                uuid.UUID
	InviteToken       string
	InviteResendCount int32
}

// ResendInvite returns pgx.ErrNoRows when the user is no longer pending, or
// when a concurrent resend already bumped invite_resend_count past the value
// the caller read.
func (q *Queries) ResendInvite(ctx context.Context, arg ResendInviteParams) (User, error) {
	row := q.db.QueryRow(ctx, resendInvite, arg.ID, arg.InviteToken, arg.InviteResendCount)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
	)
	return i, err
}

const getUserByEmail = `-- name: GetUserByEmail :one
SELECT id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count, username FROM users
WHERE email = $1
  AND deleted_at IS NULL
LIMIT 1
`

func (q *Queries) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row := q.db.QueryRow(ctx, getUserByEmail, email)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
		&i.Username,
	)
	return i, err
}

const getUserByID = `-- name: GetUserByID :one
SELECT id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count, tokens_valid_after, avatar_url, username, is_super_admin FROM users
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1
`

func (q *Queries) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	row := q.db.QueryRow(ctx, getUserByID, id)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
		&i.TokensValidAfter, &i.AvatarURL, &i.Username, &i.IsSuperAdmin,
	)
	return i, err
}

const countUserByEmailAnyStatus = `-- name: CountUserByEmailAnyStatus :one
SELECT COUNT(*) FROM users
WHERE email = $1
  AND deleted_at IS NULL
`

func (q *Queries) CountUserByEmailAnyStatus(ctx context.Context, email string) (int64, error) {
	row := q.db.QueryRow(ctx, countUserByEmailAnyStatus, email)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const listUsers = `-- name: ListUsers :many
SELECT id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count, username, avatar_url FROM users
WHERE deleted_at IS NULL
  AND ($2::text IS NULL OR status = $2)
  AND ($3::text IS NULL OR role = $3)
  AND (
    $4::timestamptz IS NULL
    OR created_at < $4
    OR (created_at = $4 AND id < $5)
  )
ORDER BY created_at DESC, id DESC
LIMIT $1
`

type ListUsersParams struct {
	Limit           int32
	Status          *string
	Role            *string
	CursorCreatedAt *time.Time
	CursorID        *uuid.UUID
}

func (q *Queries) ListUsers(ctx context.Context, arg ListUsersParams) ([]User, error) {
	rows, err := q.db.Query(ctx, listUsers, arg.Limit, arg.Status, arg.Role, arg.CursorCreatedAt, arg.CursorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []User
	for rows.Next() {
		var i User
		if err := rows.Scan(
			&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
			&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
			&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
			&i.Username, &i.AvatarURL,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const countUsers = `-- name: CountUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL
  AND ($1::text IS NULL OR status = $1)
  AND ($2::text IS NULL OR role = $2)
`

type CountUsersParams struct {
	Status *string
	Role   *string
}

func (q *Queries) CountUsers(ctx context.Context, arg CountUsersParams) (int64, error) {
	row := q.db.QueryRow(ctx, countUsers, arg.Status, arg.Role)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const seedAdminUser = `-- name: SeedAdminUser :one
INSERT INTO users (email, full_name, password_hash, status, role)
VALUES ($1, $2, $3, 'active', 'admin')
ON CONFLICT (email) WHERE deleted_at IS NULL
DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name     = EXCLUDED.full_name,
    updated_at    = NOW()
WHERE users.role = 'admin'
RETURNING id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count
`

type SeedAdminUserParams struct {
	Email        string
	FullName     *string
	PasswordHash *string
}

// SeedAdminUser returns pgx.ErrNoRows when the email belongs to an existing
// non-admin user (see the WHERE guard above) — cmd/seed treats that as
// "not ours to touch", not an error.
func (q *Queries) SeedAdminUser(ctx context.Context, arg SeedAdminUserParams) (User, error) {
	row := q.db.QueryRow(ctx, seedAdminUser, arg.Email, arg.FullName, arg.PasswordHash)
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
	)
	return i, err
}

const setUserTokensValidAfter = `-- name: SetUserTokensValidAfter :execrows
UPDATE users
SET tokens_valid_after = $2,
    updated_at         = NOW()
WHERE id = $1
  AND deleted_at IS NULL
`

func (q *Queries) SetUserTokensValidAfter(ctx context.Context, id uuid.UUID, tokensValidAfter time.Time) (int64, error) {
	result, err := q.db.Exec(ctx, setUserTokensValidAfter, id, tokensValidAfter)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
