package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// Shared wallets (specs/shared-wallets). Shape validation only; who may do
// what is WalletMemberService's job.

// InviteWalletMemberRequest is the body of POST /wallets/{id}/members.
// Identifier is an email or a tên đăng nhập.
type InviteWalletMemberRequest struct {
	Identifier string `json:"identifier" validate:"required,min=3,max=254"`
	Role       string `json:"role" validate:"required,oneof=editor viewer"`
}

// UpdateWalletMemberRequest is the body of PATCH /wallets/{id}/members/{user_id}.
type UpdateWalletMemberRequest struct {
	Role string `json:"role" validate:"required,oneof=editor viewer"`
}

// WalletMemberResponse is one row of a wallet's member list. The owner is
// listed too, with role "owner". Name is the display name, never the email.
type WalletMemberResponse struct {
	UserID     uuid.UUID  `json:"user_id"`
	Name       string     `json:"name"`
	Username   *string    `json:"username"`
	Role       string     `json:"role"`
	Status     string     `json:"status"`
	InvitedAt  *time.Time `json:"invited_at"`
	AcceptedAt *time.Time `json:"accepted_at"`
	// Invited by email, account not created yet: the app says so instead of
	// "waiting for an answer".
	AccountPending bool `json:"account_pending"`
}

func NewWalletMemberResponse(m *model.WalletMember) WalletMemberResponse {
	invitedAt := m.CreatedAt
	return WalletMemberResponse{
		UserID:     m.UserID,
		Name:       m.Name,
		Username:   m.Username,
		Role:       string(m.Role),
		Status:     string(m.Status),
		InvitedAt:  &invitedAt,
		AcceptedAt: m.AcceptedAt,

		AccountPending: m.AccountPending,
	}
}

// NewWalletOwnerResponse is the owner's row at the top of the member list.
func NewWalletOwnerResponse(userID uuid.UUID, name string, username *string) WalletMemberResponse {
	return WalletMemberResponse{
		UserID:   userID,
		Name:     name,
		Username: username,
		Role:     string(model.WalletAccessOwner),
		Status:   string(model.WalletMemberStatusActive),
	}
}

type ListWalletMembersResponse struct {
	Data []WalletMemberResponse `json:"data"`
}

// WalletInvitationResponse is a pending invitation as the invitee sees it.
type WalletInvitationResponse struct {
	WalletID       uuid.UUID `json:"wallet_id"`
	WalletName     string    `json:"wallet_name"`
	WalletCurrency string    `json:"wallet_currency"`
	WalletColor    *string   `json:"wallet_color"`
	Role           string    `json:"role"`
	OwnerName      string    `json:"owner_name"`
	InvitedAt      time.Time `json:"invited_at"`
}

type ListWalletInvitationsResponse struct {
	Data []WalletInvitationResponse `json:"data"`
}

func NewListWalletInvitationsResponse(invitations []*model.WalletInvitation) ListWalletInvitationsResponse {
	items := make([]WalletInvitationResponse, 0, len(invitations))
	for _, inv := range invitations {
		items = append(items, WalletInvitationResponse{
			WalletID:       inv.WalletID,
			WalletName:     inv.WalletName,
			WalletCurrency: inv.WalletCurrency,
			WalletColor:    inv.WalletColor,
			Role:           string(inv.Role),
			OwnerName:      inv.OwnerName,
			InvitedAt:      inv.InvitedAt,
		})
	}
	return ListWalletInvitationsResponse{Data: items}
}
