import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListNotificationsResult } from "@/features/notifications/types";

export function useNotificationsQuery(unreadOnly: boolean) {
  return useQuery({
    queryKey: ["notifications", { unreadOnly }],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListNotificationsResult }>(
        "/notifications/",
        { params: unreadOnly ? { is_read: "false" } : undefined },
      );
      return unwrap(res.data);
    },
  });
}
