import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { TRANSACTION_DETAIL_QUERY_ROOT } from "@/lib/query-persistence/persist-policy";
import { Transaction } from "@/features/transactions/types";

export const transactionDetailKey = (id: string) => [TRANSACTION_DETAIL_QUERY_ROOT, id] as const;

/**
 * GET /transactions/:id — the one response that carries a Transaction's Items
 * and Adjustments (specs/transaction-line-items plan F4). Persisted for
 * offline reading under its own root (EC-09).
 */
export function useTransactionQuery(id: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: transactionDetailKey(id ?? ""),
    enabled: Boolean(id) && (options.enabled ?? true),
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Transaction>>(`/transactions/${id}`);
      return unwrap(res.data);
    },
  });
}
