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
}

// UpdateWalletRequest is the body of PATCH /wallets/{id}. Deliberately has no
// balance or currency field at the type level (spec.md: "balance and
// currency are never accepted by this endpoint") — decoded via DecodeStrict
// so an unrecognized field like "balance" is rejected with 400, not silently
// ignored (plan.md Finding #4).
type UpdateWalletRequest struct {
	Name *string `json:"name" validate:"omitempty,max=100"`
	Type *string `json:"type" validate:"omitempty,oneof=cash bank e_wallet other"`
}

// HasUpdates reports whether at least one field was supplied — an empty
// body is a client mistake (400), not a no-op 200 (spec.md S-WAL-24).
func (r UpdateWalletRequest) HasUpdates() bool {
	return r.Name != nil || r.Type != nil
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
