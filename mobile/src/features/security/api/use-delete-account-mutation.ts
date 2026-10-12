import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { ACCOUNT_SEARCH_KEY } from "@/features/security/api/use-account-search-query";

// DELETE /admin/users/:id — soft-deletes another account and signs it out
// everywhere. Only common.AccountDeletionOperatorEmail passes the server's
// check; deleting yourself is refused there too (400).
export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // The 200 body carries no `data`, so there is nothing to unwrap.
    mutationFn: async (userId: string): Promise<void> => {
      await apiClient.delete(`/admin/users/${userId}`);
    },
    // Either way the lists refresh: a 404 means the account was already gone.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_SEARCH_KEY] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
