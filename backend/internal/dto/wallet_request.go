package dto

import (
	"bytes"
	"encoding/json"
)

// CreateWalletRequest is the body of POST /wallets. Currency defaults to
// "VND" and initial_balance to 0 when omitted — applied in WalletService,
// not here (shape validation only, per CLAUDE.md's handler/service split).
type CreateWalletRequest struct {
	Name           string `json:"name" validate:"required,max=100"`
	Type           string `json:"type" validate:"required,oneof=cash bank e_wallet other"`
	Currency       string `json:"currency" validate:"omitempty,oneof=VND USD"`
	InitialBalance int64  `json:"initial_balance" validate:"omitempty,min=0"`
	IsDefault      bool   `json:"is_default"`
	// Icon is a free-text emoji/short label; IconURL is the URL returned by
	// POST /wallets/icon (a prior upload) and takes display precedence over
	// Icon when both are set — same convention as Category
	// (specs/wallet-budget-icons/spec.md).
	Icon    *string `json:"icon" validate:"omitempty,max=32"`
	IconURL *string `json:"icon_url" validate:"omitempty,max=500"`
	// Color is a card palette key (specs/shared-wallets plan F10); the app
	// owns the actual colours. Keep this list in step with
	// mobile/src/lib/wallet-colors.ts.
	Color *string `json:"color" validate:"omitempty,oneof=blue indigo violet magenta rose orange amber lime green teal cyan slate"`
}

// UpdateWalletRequest is the body of PATCH /wallets/{id}. Deliberately has no
// balance field at the type level (spec.md: "balance is never accepted by
// this endpoint") — decoded via DecodeStrict so an unrecognized field like
// "balance" is rejected with 400, not silently ignored (plan.md Finding #4).
// Currency WAS excluded too, pending F-06's transactions table
// (wallet-management/plan.md Finding #3 / WAL-T14) — now added, since that
// table exists; WalletService.UpdateWallet gates any real currency change
// behind the 409 CURRENCY_LOCKED check (specs/transaction-management/plan.md
// Finding #2).
// IconURL is an OptionalString, not a plain *string, so an explicit
// `"icon_url": null` (clear the photo) is distinguishable from the key being
// omitted (leave it alone) — see dto.OptionalString and
// specs/wallet-budget-icons/plan.md Finding #1. Icon keeps the simpler plain
// *string/COALESCE convention (matching categories.icon) since no spec
// requires explicit emoji-clearing.
type UpdateWalletRequest struct {
	Name     *string        `json:"name" validate:"omitempty,max=100"`
	Type     *string        `json:"type" validate:"omitempty,oneof=cash bank e_wallet other"`
	Currency *string        `json:"currency" validate:"omitempty,oneof=VND USD"`
	Icon     *string        `json:"icon" validate:"omitempty,max=32"`
	IconURL  OptionalString `json:"icon_url" validate:"omitempty,max=500"`
	// Color: a palette key, or an explicit null to go back to the automatic
	// colour — an OptionalString for the same reason as IconURL.
	Color OptionalString `json:"color" validate:"omitempty,oneof=blue indigo violet magenta rose orange amber lime green teal cyan slate"`
}

// HasUpdates reports whether at least one field was supplied — an empty
// body is a client mistake (400), not a no-op 200 (spec.md S-WAL-24).
func (r UpdateWalletRequest) HasUpdates() bool {
	return r.Name != nil || r.Type != nil || r.Currency != nil || r.Icon != nil || r.IconURL.Set || r.Color.Set
}

// DecodeStrict decodes raw JSON into v, rejecting any field not present on
// the target struct. Used only by UpdateWalletRequest (plan.md Finding #4) —
// the default c.BodyParser would silently ignore an extra "balance" field
// instead of rejecting it. Every other endpoint keeps using c.BodyParser.
func DecodeStrict(body []byte, v interface{}) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
