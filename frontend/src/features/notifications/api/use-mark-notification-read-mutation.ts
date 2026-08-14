import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Notification } from "@/features/notifications/types";

async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await apiClient.post<ApiEnvelope<Notification>>(`/notifications/${id}/read`);
  return unwrap(data);
}

// Idempotent by construction (spec.md S-NOT-18) — no optimistic update
// needed here; invalidating the notifications query key on success is enough.
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
