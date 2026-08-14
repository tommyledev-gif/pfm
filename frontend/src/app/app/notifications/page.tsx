"use client";

import { useState } from "react";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useNotificationsQuery } from "@/features/notifications/api/use-notifications-query";
import { NotificationDetailDialog } from "@/features/notifications/components/notification-detail-dialog";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { NotificationListSkeleton } from "@/features/notifications/components/notification-list-skeleton";
import { getErrorMessage } from "@/lib/axios";

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useNotificationsQuery(unreadOnly);

  return (
    <div>
      <PageHeader title="Notifications" description="Budget alerts and other account activity." />

      <div className="mb-4 flex items-center justify-end">
        <Button
          data-testid="toggle-notifications-unread"
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly((v) => !v)}
        >
          {unreadOnly ? "Showing unread" : "Show unread only"}
        </Button>
      </div>

      {isError && <ErrorBanner message={getErrorMessage(error, "Failed to load notifications.")} />}
      {isLoading && <NotificationListSkeleton />}
      {!isLoading && data && <NotificationList notifications={data.data} onSelect={setSelectedId} />}

      <NotificationDetailDialog notificationId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}
