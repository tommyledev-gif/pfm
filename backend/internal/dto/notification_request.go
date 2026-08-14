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
