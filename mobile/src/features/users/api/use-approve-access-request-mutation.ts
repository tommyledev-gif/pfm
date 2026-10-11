import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { User } from "@/features/users/types";

// POST /admin/users/:id/approve — approves an access request: the requester
// becomes a pending invite and gets the activation email. Settled either way
// refetches the list, since a 409 means it was already approved elsewhere
// (the email link, another admin) and the row is stale.
export function useApproveAccessRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: User }>(
        `/admin/users/${userId}/approve`,
      );
      return unwrap(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
