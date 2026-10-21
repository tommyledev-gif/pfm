package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// WalletResponse is the explicit field whitelist for any endpoint that
// returns a wallet — same convention as UserResponse.
type WalletResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Balance   int64     `json:"balance"`
	Currency  string    `json:"currency"`
	IsDefault bool      `json:"is_default"`
	Icon      *string   `json:"icon"`
	IconURL   *string   `json:"icon_url"`
	Color     *string   `json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// Shared wallets (specs/shared-wallets US-03): the caller's access
	// ("owner" | "editor" | "viewer"), the owner's display name on someone
	// else's wallet (null on the caller's own), and the number of active
	// members besides the owner.
	Access      string  `json:"access"`
	OwnerName   *string `json:"owner_name"`
	MemberCount int     `json:"member_count"`
}

func NewWalletResponse(w *model.Wallet) WalletResponse {
	return WalletResponse{
		ID:        w.ID,
		Name:      w.Name,
		Type:      string(w.Type),
		Balance:   w.Balance,
		Currency:  w.Currency,
		IsDefault: w.IsDefault,
		Icon:      w.Icon,
		IconURL:   w.IconURL,
		Color:     w.Color,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
		// Every path that does not resolve access is the owner's own wallet
		// (create, update, set default are owner-only).
		Access:      walletAccessOrOwner(w.Access),
		OwnerName:   w.OwnerName,
		MemberCount: w.MemberCount,
	}
}

func walletAccessOrOwner(a model.WalletAccess) string {
	if a == "" {
		return string(model.WalletAccessOwner)
	}
	return string(a)
}

type ListWalletsResponse struct {
	Data []WalletResponse `json:"data"`
}

func NewListWalletsResponse(wallets []*model.Wallet) ListWalletsResponse {
	items := make([]WalletResponse, 0, len(wallets))
	for _, w := range wallets {
		items = append(items, NewWalletResponse(w))
	}
	return ListWalletsResponse{Data: items}
}
