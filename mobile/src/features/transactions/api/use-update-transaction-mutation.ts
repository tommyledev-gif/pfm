import { useMutation, useQueryClient } from "@tanstack/react-query";

import { checkBudgetLimit } from "@/features/budgets/check-budget-limit";
import { apiClient, unwrap } from "@/lib/axios";
import { TRANSACTION_DETAIL_QUERY_ROOT } from "@/lib/query-persistence/persist-policy";
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
    onSuccess: async (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: [TRANSACTION_DETAIL_QUERY_ROOT] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
      await checkBudgetLimit(queryClient, transaction);
    },
  });
}
