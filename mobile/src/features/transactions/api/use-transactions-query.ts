import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListTransactionsFilters, ListTransactionsResult } from "@/features/transactions/types";

// A search result keeps TanStack's own 5-minute cache life, not the week
// every other "transactions" list gets (query-client.ts): it is never saved
// for offline (persist-policy), so the week only kept every phrase typed this
// session, with all its loaded pages, in memory until the app was closed.
const SEARCH_GC_TIME_MS = 5 * 60 * 1000;

// `options.enabled` exists for callers that mount the hook long before it is
// allowed to run — a closed drill-down sheet, say. Without it, an unopened
// sheet's "no filters yet" call would fetch the user's entire transaction
// history the moment its host screen mounts.
//
// `keepPrevious` keeps the previous filter's rows on screen until the new
// ones land, instead of a skeleton between every search refinement.
export function useTransactionsQuery(
  filters: ListTransactionsFilters = {},
  options: { enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    enabled: options.enabled ?? true,
    gcTime: filters.search ? SEARCH_GC_TIME_MS : undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListTransactionsResult }>(
        "/transactions/",
        { params: { ...filters, cursor: pageParam } },
      );
      return unwrap(res.data);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}
