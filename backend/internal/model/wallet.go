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
	// Color is the card's palette key (specs/shared-wallets plan F10); nil =
	// the app picks one from the wallet's position.
	Color     *string
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time

	// How the caller relates to this wallet — filled only by the wallet
	// list/get paths (specs/shared-wallets US-03), zero elsewhere. Access is
	// WalletAccessOwner on the caller's own wallets.
	Access      WalletAccess
	OwnerName   *string
	MemberCount int
}

// WalletAccess is what a User may do with a Wallet (specs/shared-wallets BR-05).
type WalletAccess string

const (
	WalletAccessOwner  WalletAccess = "owner"
	WalletAccessEditor WalletAccess = "editor"
	WalletAccessViewer WalletAccess = "viewer"
)

// CanWrite reports whether this access level may record into the wallet.
func (a WalletAccess) CanWrite() bool {
	return a == WalletAccessOwner || a == WalletAccessEditor
}
