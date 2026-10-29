package dto

// ListNotificationsQuery is the query-string binding for GET /notifications.
// IsRead is a plain string (not *bool) because Fiber's query binder has no
// native bool-pointer support — same convention as dto.ReportSummaryQuery's
// string-typed filters. The handler parses it into *bool before calling
// NotificationService.ListNotifications.
type ListNotificationsQuery struct {
	IsRead string `query:"is_read" validate:"omitempty,oneof=true false"`
	Cursor string `query:"cursor"`
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=100"`
}

// MarkNotificationsReadRequest is the body of POST /notifications/read: the
// notifications the app has shown on screen. Capped at one page's maximum
// (common.MaxListLimit), the most a single screen can have shown at once.
type MarkNotificationsReadRequest struct {
	IDs []string `json:"ids" validate:"required,min=1,max=100,dive,uuid"`
}

// MarkNotificationsReadResponse says how many notifications actually moved
// from unread to read (already-read and foreign ids are not counted).
type MarkNotificationsReadResponse struct {
	Updated int64 `json:"updated"`
}
