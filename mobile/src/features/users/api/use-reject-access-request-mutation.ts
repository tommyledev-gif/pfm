import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";

// POST /admin/users/:id/reject — turns an access request down. The server
// soft-deletes the request, so it drops out of the users list (and with it
// the buttons on the admin's notification); the person can send a new
// request later. Nothing is emailed to them. Settled either way refetches
// the list, same as approve: a 409/404 means the email link or another admin
// handled it first and the row is stale.
export function useRejectAccessRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // The 200 body carries no `data`, so there is nothing to unwrap.
    mutationFn: async (userId: string): Promise<void> => {
      await apiClient.post(`/admin/users/${userId}/reject`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
