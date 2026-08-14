// Mirrors dto.NotificationResponse (backend/internal/dto/notification_response.go).
// related_budget_id/currency/period_start (the internal dedup fields) are
// never part of the API response — see that file's own doc comment.
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsPagination {
  next_cursor: string | null;
  total: number;
}

export interface ListNotificationsResult {
  data: Notification[];
  pagination: NotificationsPagination;
}
