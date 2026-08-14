"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkNotificationReadMutation } from "@/features/notifications/api/use-mark-notification-read-mutation";
import { useNotificationQuery } from "@/features/notifications/api/use-notification-query";

interface NotificationDetailDialogProps {
  notificationId: string | null;
  onOpenChange: (open: boolean) => void;
}

// A dialog, not a routed [id]/page.tsx detail page — a Notification's entire
// detail is just title + body + created_at, so a full route would be
// disproportionate (plan.md Finding #7).
export function NotificationDetailDialog({ notificationId, onOpenChange }: NotificationDetailDialogProps) {
  const { data, isLoading } = useNotificationQuery(notificationId);
  const { mutate: markRead, isPending } = useMarkNotificationReadMutation();

  return (
    <Dialog open={notificationId !== null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-notification-detail">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!isLoading && data && (
          <>
            <DialogHeader>
              <DialogTitle>{data.title}</DialogTitle>
              <DialogDescription>{new Date(data.created_at).toLocaleString()}</DialogDescription>
            </DialogHeader>
            <p className="text-sm">{data.body}</p>
            <DialogFooter>
              {!data.is_read && (
                <Button data-testid="btn-notification-mark-read" disabled={isPending} onClick={() => markRead(data.id)}>
                  Mark as read
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
