import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { markReadInCache } from "@/features/notifications/api/use-mark-notifications-read-mutations";

// In place, not a refetch of every list: under the "Chưa đọc" filter a
// refetch would drop rows the screen is still showing (useSeenNotifications).
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/notifications/${id}/read`);
    },
    onSuccess: (_data, id) => {
      markReadInCache(queryClient, new Set([id]));
      void queryClient.invalidateQueries({ queryKey: ["notifications", "has-unread"] });
    },
  });
}
