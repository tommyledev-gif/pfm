import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListAuditLogsResult } from "@/features/audit-log/types";

// GET /transactions/audit-logs — cursor-paginated, same useInfiniteQuery
// shape as use-transactions-query.ts. `transactionId` narrows to one
// Transaction's own history (the backend ownership-checks it); omitted, the
// hook returns every entry for the caller.
//
// No staleTime override: unlike the Home snapshot queries, an audit log is
// read precisely when the user wants to know what just changed, so the
// global 30s default is the right freshness here.
export function useAuditLogsQuery(transactionId?: string) {
  return useInfiniteQuery({
    queryKey: ["audit-logs", { transactionId }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListAuditLogsResult }>(
        "/transactions/audit-logs",
        { params: { transaction_id: transactionId, cursor: pageParam } },
      );
      return unwrap(res.data);
    },
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
  });
}
