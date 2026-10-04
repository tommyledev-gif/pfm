import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";

// POST /admin/users/:id/sessions/revoke-all — an admin signs another User
// out of every device (specs/mobile-account-switch US-09). Admin-only on the
// server (RequireRole); self-target is refused there too (400).
export function useRevokeUserSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // The 200 body carries no `data` (envelope omits a null payload), so
    // there is nothing to unwrap — any failure arrives as an axios error.
    mutationFn: async (userId: string): Promise<void> => {
      await apiClient.post(`/admin/users/${userId}/sessions/revoke-all`);
    },
    onError: () => {
      // A 404 means the User is gone — the list refreshes either way (S-ASW-69).
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
