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
