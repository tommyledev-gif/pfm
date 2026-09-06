import { useMutation, useQueryClient } from "@tanstack/react-query";

import { checkBudgetLimit } from "@/features/budgets/check-budget-limit";
import { apiClient, unwrap } from "@/lib/axios";
import { CreateTransactionRequest, Transaction } from "@/features/transactions/types";

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTransactionRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: Transaction }>(
        "/transactions/",
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: async (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
      // Refetches budgets itself (fresher than a bare invalidate, see that
      // helper's doc comment) and updates the ["budgets"] cache as a
      // side effect — no separate invalidateQueries(["budgets"]) needed.
      await checkBudgetLimit(queryClient, transaction);
    },
  });
}
