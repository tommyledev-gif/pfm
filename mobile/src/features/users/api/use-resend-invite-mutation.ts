import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { User } from "@/features/users/types";

// POST /admin/users/:id/resend-invite — rotates the invite token and emails a
// fresh activation link. The cooldown is the server's rule; on success OR
// failure the list is refetched, so the row's countdown always restarts from
// the server's own invite_resend_available_at (a 429 means another admin, or
// another device, just resent it).
export function useResendInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: User }>(
        `/admin/users/${userId}/resend-invite`,
      );
      return unwrap(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
