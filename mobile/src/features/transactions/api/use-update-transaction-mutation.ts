import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Transaction, UpdateTransactionRequest } from "@/features/transactions/types";

interface UpdateTransactionVariables {
  id: string;
  body: UpdateTransactionRequest;
}

// Same invalidation set as use-create-transaction-mutation.ts — an amount or
// category change reconciles the wallet balance and any budget tracking that
// category/period too.
export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: UpdateTransactionVariables) => {
      const res = await apiClient.patch<{ success: boolean; message: string; data?: Transaction }>(
        `/transactions/${id}`,
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
    },
  });
}
