export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  // The Budget a "budget_exceeded" alert was raised for — null for any type
  // that doesn't reference one. Tapping the row resolves it to that budget's
  // category and deep-links into Insights. Backend:
  // dto.NotificationResponse.
  related_budget_id: string | null;
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
