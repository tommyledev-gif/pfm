import { useMutation, useQueryClient } from "@tanstack/react-query";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
    },
  });
}
