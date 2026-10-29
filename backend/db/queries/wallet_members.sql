-- Shared wallets (specs/shared-wallets, mig 035). Hand-authored into
-- internal/repository/sqlc/wallet_members.sql.go: the local sqlc CLI
-- regenerates every file differently, so it is never run.
--
-- A "live" membership has removed_at IS NULL (pending or active). Only
-- active members have access; pending ones are invitations.

-- name: CreateWalletMember :one
INSERT INTO wallet_members (wallet_id, user_id, role, invited_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CountLiveWalletMembers :one
SELECT COUNT(*) FROM wallet_members
WHERE wallet_id = $1
  AND removed_at IS NULL;

-- name: GetLiveWalletMember :one
-- The caller's own membership of one wallet — what every access check reads.
SELECT * FROM wallet_members
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
LIMIT 1;

-- name: ListWalletMembers :many
-- Live members with the names other members see (spec BR-13). The service
-- has already checked the caller may read this wallet. user_status tells an
-- invitee who has not created their account yet (invited by email).
SELECT m.*, u.full_name, u.username, u.email, u.status AS user_status
FROM wallet_members m
JOIN users u ON u.id = m.user_id
WHERE m.wallet_id = $1
  AND m.removed_at IS NULL
ORDER BY m.created_at ASC, m.id ASC;

-- name: ListPendingWalletInvitations :many
-- The caller's own invitations, newest first, skipping wallets deleted since.
SELECT m.wallet_id, m.role, m.created_at,
       w.name AS wallet_name, w.currency AS wallet_currency, w.color AS wallet_color,
       o.full_name AS owner_full_name, o.username AS owner_username, o.email AS owner_email
FROM wallet_members m
JOIN wallets w ON w.id = m.wallet_id AND w.deleted_at IS NULL
JOIN users o ON o.id = w.user_id
WHERE m.user_id = $1
  AND m.status = 'pending'
  AND m.removed_at IS NULL
ORDER BY m.created_at DESC, m.id DESC;

-- name: AcceptWalletInvitation :one
UPDATE wallet_members
SET status = 'active', accepted_at = NOW(), updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND status = 'pending'
  AND removed_at IS NULL
RETURNING *;

-- name: UpdateWalletMemberRole :one
UPDATE wallet_members
SET role = $3, updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
RETURNING *;

-- name: RemoveWalletMember :one
-- Decline, cancel, remove and leave are all this one soft removal; the row
-- stays for history and no transaction is touched (spec BR-08).
UPDATE wallet_members
SET removed_at = NOW(), updated_at = NOW()
WHERE wallet_id = $1
  AND user_id = $2
  AND removed_at IS NULL
RETURNING *;

-- name: ListSharedWalletsForUser :many
-- Wallets other people own that the caller is an active member of.
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
ORDER BY m.accepted_at ASC, w.created_at ASC;

-- name: CountActiveMembersByWallets :many
SELECT wallet_id, COUNT(*)::bigint AS member_count
FROM wallet_members
WHERE wallet_id = ANY($1::uuid[])
  AND status = 'active'
  AND removed_at IS NULL
GROUP BY wallet_id;

-- name: ListUserDisplayNames :many
-- Names of whoever recorded the entries on a shared wallet's page. The ids
-- come only from rows the service already let the caller read. Deleted
-- accounts included on purpose: their entries still show who made them.
SELECT id, full_name, username, email FROM users
WHERE id = ANY($1::uuid[]);

-- name: CreateWalletNotification :exec
-- wallet_invite (to the invitee) and wallet_member_joined (to the owner);
-- related_user_id is the other person.
INSERT INTO notifications (user_id, type, title, body, related_user_id)
VALUES ($1, $2, $3, $4, $5);
