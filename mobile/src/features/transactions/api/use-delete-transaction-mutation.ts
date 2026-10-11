import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { TRANSACTION_DETAIL_QUERY_ROOT } from "@/lib/query-persistence/persist-policy";

// Same invalidation set as create/update — deleting a transaction reconciles
// the wallet balance and any budget tracking that category/period.
export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: [TRANSACTION_DETAIL_QUERY_ROOT] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
      // The delete writes an audit entry server side, so a log screen left
      // open behind this would otherwise keep showing history without it.
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
