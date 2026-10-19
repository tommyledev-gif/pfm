import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { DeviceSession } from "@/features/security/types";

// Per User: two accounts on one phone see different lists.
const deviceSessionsKey = (userId: string | null) => ["device-sessions", userId] as const;

/** GET /auth/sessions — where the signed-in account is in use, newest first. */
export function useDeviceSessionsQuery() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: deviceSessionsKey(userId),
    enabled: userId !== null,
    queryFn: async () => unwrap((await apiClient.get<ApiEnvelope<{ data: DeviceSession[] }>>("/auth/sessions")).data).data,
  });
}

/** DELETE /auth/sessions/:id — signs one other device out of this account. */
export function useSignOutDeviceMutation() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(`/auth/sessions/${sessionId}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: deviceSessionsKey(userId) }),
  });
}
