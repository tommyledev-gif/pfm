import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { Me } from "@/features/users/types";

// One entry per signed-in User. "profile" is a persisted query root
// (lib/query-persistence/persist-policy.ts) so the name and picture are still
// there offline.
export const profileQueryKey = (userId: string | null) => ["profile", userId] as const;

// GET /users/me — the signed-in User's own name, email, role and avatar, and
// whether the Security screen offers the account deletion tool.
export function useProfileQuery() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: profileQueryKey(userId),
    enabled: userId !== null,
    queryFn: async () => unwrap((await apiClient.get<ApiEnvelope<Me>>("/users/me")).data),
    staleTime: SNAPSHOT_STALE_TIME_MS,
  });
}
