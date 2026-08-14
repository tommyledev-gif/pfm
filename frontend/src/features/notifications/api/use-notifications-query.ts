import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ListNotificationsResult } from "@/features/notifications/types";

async function fetchNotifications(unreadOnly: boolean): Promise<ListNotificationsResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListNotificationsResult>>("/notifications", {
    params: unreadOnly ? { is_read: "false" } : undefined,
  });
  return unwrap(data);
}

export function useNotificationsQuery(unreadOnly: boolean) {
  return useQuery({
    queryKey: ["notifications", { unreadOnly }],
    queryFn: () => fetchNotifications(unreadOnly),
  });
}
