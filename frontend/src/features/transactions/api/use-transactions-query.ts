import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ListTransactionsResult, TransactionFilters } from "@/features/transactions/types";

async function fetchTransactions(filters: TransactionFilters, cursor?: string): Promise<ListTransactionsResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListTransactionsResult>>("/transactions", {
    params: {
      wallet_id: filters.walletId || undefined,
      category_id: filters.categoryId || undefined,
      type: filters.type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      cursor: cursor || undefined,
    },
  });
  return unwrap(data);
}

// Cursor-based "Load more" pagination (spec.md Edge Cases US-02 #1) — the
// only feature using useInfiniteQuery instead of a single unpaginated
// useQuery, since a personal user's Transaction history can grow large
// unlike every prior feature's bounded list.
export function useTransactionsQuery(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    queryFn: ({ pageParam }) => fetchTransactions(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}
