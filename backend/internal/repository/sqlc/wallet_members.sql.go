package sqlc

// Hand-authored to match db/queries/wallet_members.sql (specs/shared-wallets,
// mig 035): the local sqlc CLI regenerates every file differently, so it is
// never run. Column lists are spelled out, as sqlc would.

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// WalletMember mirrors the wallet_members table exactly.
type WalletMember struct {
	ID         uuid.UUID
	WalletID   uuid.UUID
	UserID     uuid.UUID
	Role       string
	Status     string
	InvitedBy  uuid.UUID
	CreatedAt  time.Time
	UpdatedAt  time.Time
	AcceptedAt *time.Time
	RemovedAt  *time.Time
}

const walletMemberColumns = `id, wallet_id, user_id, role, status, invited_by, created_at, updated_at, accepted_at, removed_at`

func scanWalletMember(row interface{ Scan(dest ...any) error }) (WalletMember, error) {
	var i WalletMember
	err := row.Scan(&i.ID, &i.WalletID, &i.UserID, &i.Role, &i.Status, &i.InvitedBy, &i.CreatedAt, &i.UpdatedAt, &i.AcceptedAt, &i.RemovedAt)
	return i, err
}

const createWalletMember = `-- name: CreateWalletMember :one
INSERT INTO wallet_members (wallet_id, user_id, role, invited_by)
VALUES ($1, $2, $3, $4)
RETURNING ` + walletMemberColumns

func (q *Queries) CreateWalletMember(ctx context.Context, walletID, userID uuid.UUID, role string, invitedBy uuid.UUID) (WalletMember, error) {
	return scanWalletMember(q.db.QueryRow(ctx, createWalletMember, walletID, userID, role, invitedBy))
}

const countLiveWalletMembers = `-- name: CountLiveWalletMembers :one
SELECT COUNT(*) FROM wallet_members
WHERE wallet_id = $1
  AND removed_at IS NULL`

func (q *Queries) CountLiveWalletMembers(ctx context.Context, walletID uuid.UUID) (int64, error) {
	var count int64
	err := q.db.QueryRow(ctx, countLiveWalletMembers, walletID).Scan(&count)
	return count, err
}

const getLiveWalletMember = `-- name: GetLiveWalletMember :one
SELECT ` + walletMemberColumns + ` FROM wallet_members
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
LIMIT 1`

// GetLiveWalletMember returns pgx.ErrNoRows when userID has no live
// membership of walletID.
func (q *Queries) GetLiveWalletMember(ctx context.Context, walletID, userID uuid.UUID) (WalletMember, error) {
	return scanWalletMember(q.db.QueryRow(ctx, getLiveWalletMember, walletID, userID))
}

const listWalletMembers = `-- name: ListWalletMembers :many
SELECT m.id, m.wallet_id, m.user_id, m.role, m.status, m.invited_by, m.created_at, m.updated_at, m.accepted_at, m.removed_at,
       u.full_name, u.username, u.email
FROM wallet_members m
JOIN users u ON u.id = m.user_id
WHERE m.wallet_id = $1
  AND m.removed_at IS NULL
ORDER BY m.created_at ASC, m.id ASC`

type ListWalletMembersRow struct {
	WalletMember
	FullName *string
	Username *string
	Email    string
}

func (q *Queries) ListWalletMembers(ctx context.Context, walletID uuid.UUID) ([]ListWalletMembersRow, error) {
	rows, err := q.db.Query(ctx, listWalletMembers, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListWalletMembersRow
	for rows.Next() {
		var i ListWalletMembersRow
		if err := rows.Scan(
			&i.ID, &i.WalletID, &i.UserID, &i.Role, &i.Status, &i.InvitedBy, &i.CreatedAt, &i.UpdatedAt, &i.AcceptedAt, &i.RemovedAt,
			&i.FullName, &i.Username, &i.Email,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listPendingWalletInvitations = `-- name: ListPendingWalletInvitations :many
SELECT m.wallet_id, m.role, m.created_at,
       w.name AS wallet_name, w.currency AS wallet_currency, w.color AS wallet_color,
       o.full_name AS owner_full_name, o.username AS owner_username, o.email AS owner_email
FROM wallet_members m
JOIN wallets w ON w.id = m.wallet_id AND w.deleted_at IS NULL
JOIN users o ON o.id = w.user_id
WHERE m.user_id = $1
  AND m.status = 'pending'
  AND m.removed_at IS NULL
ORDER BY m.created_at DESC, m.id DESC`

type ListPendingWalletInvitationsRow struct {
	WalletID       uuid.UUID
	Role           string
	CreatedAt      time.Time
	WalletName     string
	WalletCurrency string
	WalletColor    *string
	OwnerFullName  *string
	OwnerUsername  *string
	OwnerEmail     string
}

func (q *Queries) ListPendingWalletInvitations(ctx context.Context, userID uuid.UUID) ([]ListPendingWalletInvitationsRow, error) {
	rows, err := q.db.Query(ctx, listPendingWalletInvitations, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListPendingWalletInvitationsRow
	for rows.Next() {
		var i ListPendingWalletInvitationsRow
		if err := rows.Scan(
			&i.WalletID, &i.Role, &i.CreatedAt, &i.WalletName, &i.WalletCurrency, &i.WalletColor,
			&i.OwnerFullName, &i.OwnerUsername, &i.OwnerEmail,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const acceptWalletInvitation = `-- name: AcceptWalletInvitation :one
UPDATE wallet_members
SET status = 'active', accepted_at = NOW(), updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND status = 'pending'
  AND removed_at IS NULL
RETURNING ` + walletMemberColumns

func (q *Queries) AcceptWalletInvitation(ctx context.Context, walletID, userID uuid.UUID) (WalletMember, error) {
	return scanWalletMember(q.db.QueryRow(ctx, acceptWalletInvitation, walletID, userID))
}

const updateWalletMemberRole = `-- name: UpdateWalletMemberRole :one
UPDATE wallet_members
SET role = $3, updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
RETURNING ` + walletMemberColumns

func (q *Queries) UpdateWalletMemberRole(ctx context.Context, walletID, userID uuid.UUID, role string) (WalletMember, error) {
	return scanWalletMember(q.db.QueryRow(ctx, updateWalletMemberRole, walletID, userID, role))
}

const removeWalletMember = `-- name: RemoveWalletMember :one
UPDATE wallet_members
SET removed_at = NOW(), updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
RETURNING ` + walletMemberColumns

func (q *Queries) RemoveWalletMember(ctx context.Context, walletID, userID uuid.UUID) (WalletMember, error) {
	return scanWalletMember(q.db.QueryRow(ctx, removeWalletMember, walletID, userID))
}

const listSharedWalletsForUser = `-- name: ListSharedWalletsForUser :many
SELECT w.id, w.user_id, w.name, w.type, w.balance, w.currency, w.is_default,
       w.created_at, w.updated_at, w.deleted_at, w.icon, w.icon_url, w.color,
       m.role AS member_role,
       o.full_name AS owner_full_name, o.username AS owner_username, o.email AS owner_email
FROM wallet_members m
JOIN wallets w ON w.id = m.wallet_id AND w.deleted_at IS NULL
JOIN users o ON o.id = w.user_id
WHERE m.user_id = $1
  AND m.status = 'active'
  AND m.removed_at IS NULL
ORDER BY m.accepted_at ASC, w.created_at ASC`

type ListSharedWalletsForUserRow struct {
	Wallet
	MemberRole    string
	OwnerFullName *string
	OwnerUsername *string
	OwnerEmail    string
}

func (q *Queries) ListSharedWalletsForUser(ctx context.Context, userID uuid.UUID) ([]ListSharedWalletsForUserRow, error) {
	rows, err := q.db.Query(ctx, listSharedWalletsForUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListSharedWalletsForUserRow
	for rows.Next() {
		var i ListSharedWalletsForUserRow
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency, &i.IsDefault,
			&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.Icon, &i.IconURL, &i.Color,
			&i.MemberRole, &i.OwnerFullName, &i.OwnerUsername, &i.OwnerEmail,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const countActiveMembersByWallets = `-- name: CountActiveMembersByWallets :many
SELECT wallet_id, COUNT(*)::bigint AS member_count
FROM wallet_members
WHERE wallet_id = ANY($1::uuid[])
  AND status = 'active'
  AND removed_at IS NULL
GROUP BY wallet_id`

type CountActiveMembersByWalletsRow struct {
	WalletID    uuid.UUID
	MemberCount int64
}

func (q *Queries) CountActiveMembersByWallets(ctx context.Context, walletIDs []uuid.UUID) ([]CountActiveMembersByWalletsRow, error) {
	rows, err := q.db.Query(ctx, countActiveMembersByWallets, walletIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CountActiveMembersByWalletsRow
	for rows.Next() {
		var i CountActiveMembersByWalletsRow
		if err := rows.Scan(&i.WalletID, &i.MemberCount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listUserDisplayNames = `-- name: ListUserDisplayNames :many
SELECT id, full_name, username, email FROM users
WHERE id = ANY($1::uuid[])`

type ListUserDisplayNamesRow struct {
	ID       uuid.UUID
	FullName *string
	Username *string
	Email    string
}

func (q *Queries) ListUserDisplayNames(ctx context.Context, ids []uuid.UUID) ([]ListUserDisplayNamesRow, error) {
	rows, err := q.db.Query(ctx, listUserDisplayNames, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListUserDisplayNamesRow
	for rows.Next() {
		var i ListUserDisplayNamesRow
		if err := rows.Scan(&i.ID, &i.FullName, &i.Username, &i.Email); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const createWalletNotification = `-- name: CreateWalletNotification :exec
INSERT INTO notifications (user_id, type, title, body, related_user_id)
VALUES ($1, $2, $3, $4, $5)`

func (q *Queries) CreateWalletNotification(ctx context.Context, userID uuid.UUID, notificationType, title, body string, relatedUserID uuid.UUID) error {
	_, err := q.db.Exec(ctx, createWalletNotification, userID, notificationType, title, body, relatedUserID)
	return err
}
