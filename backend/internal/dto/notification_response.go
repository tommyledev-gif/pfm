package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// NotificationResponse is the explicit field whitelist for any endpoint that
// returns a Notification — same convention as WalletResponse/BudgetResponse.
// Currency/PeriodStart (the internal dedup fields, spec.md Edge Cases US-01
// #3) stay unexposed — Title/Body are already the human-readable rendering of
// that data.
//
// RelatedBudgetID is the exception, and is exposed as `related_budget_id`
// (null for any notification type that doesn't reference a Budget): tapping a
// budget alert now deep-links into Insights with that budget's category
// selected, and rendered prose is not something a client can route on.
type NotificationResponse struct {
	ID              uuid.UUID  `json:"id"`
	Type            string     `json:"type"`
	Title           string     `json:"title"`
	Body            string     `json:"body"`
	IsRead          bool       `json:"is_read"`
	RelatedBudgetID *uuid.UUID `json:"related_budget_id"`
	// RelatedUserID is the requester on an 'access_request' notification
	// (mig 031), so the admin can approve from it; null otherwise.
	RelatedUserID *uuid.UUID `json:"related_user_id"`
	CreatedAt     time.Time  `json:"created_at"`
}

func NewNotificationResponse(n *model.Notification) NotificationResponse {
	return NotificationResponse{
		ID:              n.ID,
		Type:            string(n.Type),
		Title:           n.Title,
		Body:            n.Body,
		IsRead:          n.IsRead,
		RelatedBudgetID: n.RelatedBudgetID,
		RelatedUserID:   n.RelatedUserID,
		CreatedAt:       n.CreatedAt,
	}
}

type ListNotificationsResponse struct {
	Data       []NotificationResponse `json:"data"`
	Pagination PaginationResponse     `json:"pagination"`
}
