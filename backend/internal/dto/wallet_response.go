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
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
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
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
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
