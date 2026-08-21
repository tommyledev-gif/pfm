package dto

import (
	"bytes"
	"encoding/json"
)

// OptionalString distinguishes three JSON states for a single field: absent
// (Set=false), explicit null (Set=true, Value=nil), and a real value
// (Set=true, Value=&s) — something a plain *string cannot do, since both
// "absent" and "explicit null" decode to a nil pointer under the standard
// library's default json.Unmarshal. Needed wherever a client must be able to
// explicitly clear a nullable field (e.g. icon_url) via PATCH, as opposed to
// merely never mentioning it (specs/wallet-budget-icons/plan.md Finding #1 —
// the bug this type exists to avoid: a COALESCE(narg, col)-style SQL update
// can never distinguish "leave alone" from "clear" once both collapse to a
// Go nil).
type OptionalString struct {
	Value *string
	Set   bool
}

// UnmarshalJSON is only ever invoked by encoding/json when the field's key is
// actually present in the source object — an omitted key leaves Set at its
// zero value (false), which is exactly the "absent" case this type exists to
// capture.
func (o *OptionalString) UnmarshalJSON(data []byte) error {
	o.Set = true
	if bytes.Equal(data, []byte("null")) {
		o.Value = nil
		return nil
	}
	return json.Unmarshal(data, &o.Value)
}
