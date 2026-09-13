package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// CategoryResponse is the explicit field whitelist for any endpoint that
// returns a category — same convention as WalletResponse. UserID is
// exposed (nullable) so the client can distinguish a system default (locked,
// read-only) from the caller's own category (spec.md US-02 Edge Case #2).
type CategoryResponse struct {
	ID        uuid.UUID  `json:"id"`
	UserID    *uuid.UUID `json:"user_id"`
	Name      string     `json:"name"`
	Icon      *string    `json:"icon"`
	Type      string     `json:"type"`
	CreatedAt time.Time  `json:"created_at"`
	IconURL   *string    `json:"icon_url"`
	// SystemKey is how the budget wizard's presets find a category. nil for
	// anything the user created themselves.
	SystemKey *string `json:"system_key"`
}

func NewCategoryResponse(c *model.Category) CategoryResponse {
	return CategoryResponse{
		ID:        c.ID,
		UserID:    c.UserID,
		Name:      c.Name,
		Icon:      c.Icon,
		Type:      string(c.Type),
		CreatedAt: c.CreatedAt,
		IconURL:   c.IconURL,
		SystemKey: c.SystemKey,
	}
}

type ListCategoriesResponse struct {
	Data []CategoryResponse `json:"data"`
}

func NewListCategoriesResponse(categories []*model.Category) ListCategoriesResponse {
	items := make([]CategoryResponse, 0, len(categories))
	for _, c := range categories {
		items = append(items, NewCategoryResponse(c))
	}
	return ListCategoriesResponse{Data: items}
}
