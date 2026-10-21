package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// WalletMemberRole is what a member (not the owner) may do in a shared
// wallet (specs/shared-wallets BR-05).
type WalletMemberRole string

const (
	WalletMemberRoleEditor WalletMemberRole = "editor"
	WalletMemberRoleViewer WalletMemberRole = "viewer"
)

// Access is the WalletAccess this role grants.
func (r WalletMemberRole) Access() WalletAccess {
	if r == WalletMemberRoleEditor {
		return WalletAccessEditor
	}
	return WalletAccessViewer
}

type WalletMemberStatus string

const (
	WalletMemberStatusPending WalletMemberStatus = "pending"
	WalletMemberStatusActive  WalletMemberStatus = "active"
)

// WalletMember is one row of wallet_members (mig 035). The owner of a wallet
// is wallets.user_id and never has one. Name/Username are filled only by the
// member-list query.
type WalletMember struct {
	ID         uuid.UUID
	WalletID   uuid.UUID
	UserID     uuid.UUID
	Role       WalletMemberRole
	Status     WalletMemberStatus
	InvitedBy  uuid.UUID
	CreatedAt  time.Time
	UpdatedAt  time.Time
	AcceptedAt *time.Time
	RemovedAt  *time.Time

	Name     string
	Username *string
}

// IsActive reports whether the membership grants access (an accepted,
// not removed invitation).
func (m *WalletMember) IsActive() bool {
	return m.Status == WalletMemberStatusActive && m.RemovedAt == nil
}

// WalletInvitation is a pending invitation as the invitee sees it.
type WalletInvitation struct {
	WalletID       uuid.UUID
	WalletName     string
	WalletCurrency string
	WalletColor    *string
	Role           WalletMemberRole
	OwnerName      string
	InvitedAt      time.Time
}

// DisplayName is the name other people see for an account: the full name,
// else the tên đăng nhập, else the part of the email before the @. Never the
// whole email, so a member list does not hand out addresses.
func DisplayName(fullName, username *string, email string) string {
	if fullName != nil {
		if name := strings.TrimSpace(*fullName); name != "" {
			return name
		}
	}
	if username != nil && *username != "" {
		return *username
	}
	if at := strings.IndexByte(email, '@'); at > 0 {
		return email[:at]
	}
	return email
}
