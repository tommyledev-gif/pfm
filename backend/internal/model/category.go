package model

import (
	"time"

	"github.com/google/uuid"
)

type CategoryType string

const (
	CategoryTypeIncome  CategoryType = "income"
	CategoryTypeExpense CategoryType = "expense"
)

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
}

// IsSystem reports whether this category is a shared, system-defined
// default (user_id IS NULL) — never writable through the user-facing API.
func (c *Category) IsSystem() bool {
	return c.UserID == nil
}
