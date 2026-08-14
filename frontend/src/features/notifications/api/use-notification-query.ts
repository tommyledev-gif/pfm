import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Notification } from "@/features/notifications/types";

async function fetchNotification(id: string): Promise<Notification> {
  const { data } = await apiClient.get<ApiEnvelope<Notification>>(`/notifications/${id}`);
  return unwrap(data);
}

// Viewing a Notification never marks it as read as a side effect (spec.md
// US-02 Edge Case #1) — that is a separate, explicit mutation.
export function useNotificationQuery(id: string | null) {
  return useQuery({
    queryKey: ["notifications", id],
    queryFn: () => fetchNotification(id as string),
    enabled: id !== null,
  });
}
