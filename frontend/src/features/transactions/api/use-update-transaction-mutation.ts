import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Transaction, UpdateTransactionRequest } from "@/features/transactions/types";

interface UpdateTransactionVariables {
  transactionId: string;
  req: UpdateTransactionRequest;
}

async function updateTransaction({ transactionId, req }: UpdateTransactionVariables): Promise<Transaction> {
  const { data } = await apiClient.patch<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`, req);
  return unwrap(data);
}

// Idempotent in effect (spec.md US-04 Idempotency note). Invalidates wallets
// and budgets too — an amount change reconciles the wallet balance directly
// (possibly leaving it negative, spec.md Context #3) and, via F-05's live
// spend computation, every budget tracking this category/period.
export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.transactionId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
