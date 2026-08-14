package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// NotificationResponse is the explicit field whitelist for any endpoint that
// returns a Notification — same convention as WalletResponse/BudgetResponse.
// RelatedBudgetID/Currency/PeriodStart (the internal dedup fields, spec.md
// Edge Cases US-01 #3) are deliberately never exposed here — Title/Body are
// already the human-readable rendering of that data.
type NotificationResponse struct {
	ID        uuid.UUID `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

func NewNotificationResponse(n *model.Notification) NotificationResponse {
	return NotificationResponse{
		ID:        n.ID,
		Type:      string(n.Type),
		Title:     n.Title,
		Body:      n.Body,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt,
	}
}

type ListNotificationsResponse struct {
	Data       []NotificationResponse `json:"data"`
	Pagination PaginationResponse     `json:"pagination"`
}
