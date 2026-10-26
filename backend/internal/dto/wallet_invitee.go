package dto

import (
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// WalletInviteeQuery is GET /wallets/{id}/members/lookup?identifier=: the
// invite field's email or tên đăng nhập, the same shape Invite accepts.
type WalletInviteeQuery struct {
	Identifier string `query:"identifier" validate:"required,min=3,max=254"`
}

// WalletInviteeResponse is who an invitation would reach. Name is the
// display name; Membership is none | pending | active | self.
type WalletInviteeResponse struct {
	UserID     uuid.UUID `json:"user_id"`
	Name       string    `json:"name"`
	Username   *string   `json:"username"`
	AvatarURL  *string   `json:"avatar_url"`
	Membership string    `json:"membership"`
}

func NewWalletInviteeResponse(user *model.User, membership string) WalletInviteeResponse {
	return WalletInviteeResponse{
		UserID:     user.ID,
		Name:       model.DisplayName(user.FullName, user.Username, user.Email),
		Username:   user.Username,
		AvatarURL:  user.AvatarURL,
		Membership: membership,
	}
}
