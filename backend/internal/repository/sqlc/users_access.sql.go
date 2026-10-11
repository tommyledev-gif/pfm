package sqlc

import (
	"context"

	"github.com/google/uuid"
)

// Hand-authored (see db/queries/users.sql): tên đăng nhập lookup (mig 030)
// and access requests (mig 031). Every query here returns userColumns.
const userColumns = `id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at, invite_sent_at, invite_resend_count, username`

func scanUser(row rowScanner) (User, error) {
	var i User
	err := row.Scan(
		&i.ID, &i.Email, &i.FullName, &i.PasswordHash, &i.Status, &i.Role,
		&i.InvitedBy, &i.InviteToken, &i.InviteExpiresAt, &i.ActivatedAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.InviteSentAt, &i.InviteResendCount,
		&i.Username,
	)
	return i, err
}

const getUserByUsername = `-- name: GetUserByUsername :one
SELECT ` + userColumns + ` FROM users
WHERE username = $1
  AND deleted_at IS NULL
LIMIT 1`

func (q *Queries) GetUserByUsername(ctx context.Context, username string) (User, error) {
	return scanUser(q.db.QueryRow(ctx, getUserByUsername, username))
}

const createAccessRequest = `-- name: CreateAccessRequest :one
INSERT INTO users (email, role, status, invited_by, approval_token)
VALUES ($1, 'member', 'requested', $2, $3)
RETURNING ` + userColumns

// CreateAccessRequest fails with a unique violation when the email already
// belongs to a live account (any status).
func (q *Queries) CreateAccessRequest(ctx context.Context, email string, adminID uuid.UUID, approvalToken string) (User, error) {
	return scanUser(q.db.QueryRow(ctx, createAccessRequest, email, adminID, approvalToken))
}

const getUserByApprovalToken = `-- name: GetUserByApprovalToken :one
SELECT ` + userColumns + ` FROM users
WHERE approval_token = $1
  AND status = 'requested'
  AND deleted_at IS NULL
LIMIT 1`

func (q *Queries) GetUserByApprovalToken(ctx context.Context, approvalToken string) (User, error) {
	return scanUser(q.db.QueryRow(ctx, getUserByApprovalToken, approvalToken))
}

const approveAccessRequest = `-- name: ApproveAccessRequest :one
UPDATE users
SET
    status              = 'pending',
    approval_token      = NULL,
    invite_token        = $2,
    invite_expires_at   = NOW() + INTERVAL '72 hours',
    invite_sent_at      = NOW(),
    invite_resend_count = 0,
    updated_at          = NOW()
WHERE id = $1
  AND status = 'requested'
  AND deleted_at IS NULL
RETURNING ` + userColumns

// ApproveAccessRequest returns pgx.ErrNoRows when the request is no longer
// waiting — the WHERE status = 'requested' is the race arbiter, so of two
// approvals (email link and app at once) exactly one sends the invite.
func (q *Queries) ApproveAccessRequest(ctx context.Context, id uuid.UUID, inviteToken string) (User, error) {
	return scanUser(q.db.QueryRow(ctx, approveAccessRequest, id, inviteToken))
}
