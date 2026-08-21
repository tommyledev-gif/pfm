package model

import (
	"time"

	"github.com/google/uuid"
)

type WalletType string

const (
	WalletTypeCash    WalletType = "cash"
	WalletTypeBank    WalletType = "bank"
	WalletTypeEWallet WalletType = "e_wallet"
	WalletTypeOther   WalletType = "other"
)

// Wallet is the domain representation of the wallets table. Zero framework
// imports (no Fiber, pgx, or sqlc types) — see model/user.go for the same
// convention. Balance is integer cents (CLAUDE.md: never float for money).
type Wallet struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Name      string
	Type      WalletType
	Balance   int64
	Currency  string
	IsDefault bool
	Icon      *string
	IconURL   *string
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}
