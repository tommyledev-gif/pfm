import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Transaction } from "@/features/transactions/types";

async function fetchTransaction(transactionId: string): Promise<Transaction> {
  const { data } = await apiClient.get<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`);
  return unwrap(data);
}

export function useTransactionQuery(transactionId: string) {
  return useQuery({
    queryKey: ["transactions", transactionId],
    queryFn: () => fetchTransaction(transactionId),
    enabled: !!transactionId,
  });
}
