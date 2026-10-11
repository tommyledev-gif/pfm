package model

import (
	"time"

	"github.com/google/uuid"
)

// NotificationType values — MVP only ever emits NotificationTypeBudgetExceeded
// (specs/notification-handling/spec.md Context decision #1). Stored as a
// free-text column for forward-compatibility, mirroring model.BudgetPeriod's
// "monthly"-only precedent.
type NotificationType string

const (
	NotificationTypeBudgetExceeded NotificationType = "budget_exceeded"
	// NotificationTypeAccessRequest goes to an admin when someone asks for an
	// account (mig 031); RelatedUserID is the requester.
	NotificationTypeAccessRequest NotificationType = "access_request"
)

// Notification is the domain representation of the notifications table. Zero
// framework imports, same convention as model.Wallet/model.Budget.
// RelatedBudgetID/Currency/PeriodStart are only populated for
// NotificationTypeBudgetExceeded (spec.md Domain Fields) — nil for any
// future notification type that doesn't reference a Budget. Title/Body are
// fully rendered at creation time, never re-derived from RelatedBudgetID at
// read time (spec.md Context decision #3).
type Notification struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	Type            NotificationType
	Title           string
	Body            string
	IsRead          bool
	RelatedBudgetID *uuid.UUID
	Currency        *string
	PeriodStart     *time.Time
	CreatedAt       time.Time
	RelatedUserID   *uuid.UUID
}
