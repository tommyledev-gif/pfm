import { Badge } from "@/components/ui/badge";
import type { Notification } from "@/features/notifications/types";

interface NotificationListProps {
  notifications: Notification[];
  onSelect: (id: string) => void;
}

export function NotificationList({ notifications, onSelect }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <p data-testid="text-notifications-empty" className="py-8 text-center text-sm text-muted-foreground">
        No notifications yet.
      </p>
    );
  }

  return (
    <div data-testid="list-notifications" className="divide-y rounded-md border">
      {notifications.map((notification) => (
        <button
          key={notification.id}
          type="button"
          data-testid={notification.is_read ? "row-notification-read" : "row-notification-unread"}
          onClick={() => onSelect(notification.id)}
          className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={notification.is_read ? "text-sm text-muted-foreground" : "text-sm font-semibold"}>
                {notification.title}
              </span>
              {!notification.is_read && <Badge variant="default">New</Badge>}
            </div>
            <p className="line-clamp-1 text-sm text-muted-foreground">{notification.body}</p>
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(notification.created_at).toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}
