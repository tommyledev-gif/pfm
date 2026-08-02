import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Transaction } from "@/features/transactions/types";

async function deleteTransaction(transactionId: string): Promise<Transaction> {
  const { data } = await apiClient.delete<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`);
  return unwrap(data);
}

// Not idempotent (spec.md US-05 Idempotency note) — a second delete on the
// same id 404s. Invalidates wallets and budgets too — deleting reverses the
// wallet balance effect (possibly leaving it negative, spec.md Context #3)
// and, via F-05's live spend computation, affects every budget tracking
// this category/period.
export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: (_, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions", transactionId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
