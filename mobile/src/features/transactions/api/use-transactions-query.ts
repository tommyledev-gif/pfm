import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListTransactionsFilters, ListTransactionsResult } from "@/features/transactions/types";

export function useTransactionsQuery(filters: ListTransactionsFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListTransactionsResult }>(
        "/transactions/",
        { params: { ...filters, cursor: pageParam } },
      );
      return unwrap(res.data);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}
