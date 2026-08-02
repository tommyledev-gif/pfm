import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { CreateTransactionRequest, Transaction } from "@/features/transactions/types";

async function createTransaction(req: CreateTransactionRequest): Promise<Transaction> {
  const { data } = await apiClient.post<ApiEnvelope<Transaction>>("/transactions", req);
  return unwrap(data);
}

// Not idempotent (spec.md US-01 Idempotency note) — no key; a duplicate
// submission would doubly mutate the wallet's real balance. Invalidates
// wallets and budgets too — this mutation changes wallet balance directly
// and (via F-05's live spend computation) every budget tracking this
// category/period.
export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
