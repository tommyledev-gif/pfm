package model

import (
	"time"

	"github.com/google/uuid"
)

type CategoryType string

const (
	CategoryTypeIncome  CategoryType = "income"
	CategoryTypeExpense CategoryType = "expense"
	// CategoryTypeTransfer exists for exactly one system Category (system_key
	// SystemKeyTransfer), which the service assigns to every transfer. Users
	// can never create one, and it never appears in category listings.
	CategoryTypeTransfer CategoryType = "transfer"
)

// SystemKeyTransfer is the system_key of the Category every transfer uses.
const SystemKeyTransfer = "transfer"

// Category is the domain representation of the categories table. Zero
// framework imports, same convention as model.Wallet. UserID nil means
// system-defined — shared, read-only to every user (spec.md F-04 Context).
type Category struct {
	ID        uuid.UUID
	UserID    *uuid.UUID
	Name      string
	Icon      *string
	Type      CategoryType
	CreatedAt time.Time
	DeletedAt *time.Time
	// IconURL is an uploaded custom image (Cloudflare R2 — see
	// service.R2IconUploader), distinct from Icon's free-text emoji/label.
	// When set, clients should prefer it over Icon for display.
	IconURL *string
	// SystemKey is the stable identifier for a system-defined category
	// (migration 019). nil for anything a user created themselves.
	//
	// It exists so the budget wizard's presets can resolve to real categories
	// without going through display names. Name matching broke as soon as the
	// seeded names (English) and the presets (Vietnamese) had to agree, and it
	// breaks again whenever a category is renamed. A category's name is for
	// people; this is for code.
	SystemKey *string
}

// IsSystem reports whether this category is a shared, system-defined
// default (user_id IS NULL) — never writable through the user-facing API.
func (c *Category) IsSystem() bool {
	return c.UserID == nil
}
