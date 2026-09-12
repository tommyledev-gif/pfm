import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListTransactionsFilters, ListTransactionsResult } from "@/features/transactions/types";

// `options.enabled` exists for callers that mount the hook long before it is
// allowed to run — a closed drill-down sheet, say. Without it, an unopened
// sheet's "no filters yet" call would fetch the user's entire transaction
// history the moment its host screen mounts.
export function useTransactionsQuery(filters: ListTransactionsFilters = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    enabled: options.enabled ?? true,
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
