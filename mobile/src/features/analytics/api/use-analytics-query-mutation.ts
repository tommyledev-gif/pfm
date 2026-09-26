import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { AnalyticsAnswer, AnalyticsQuery } from "@/features/analytics/types";

// A mutation, not a query: each answer is a one-off snapshot appended to the
// chat thread (spec.md US-06), not live server state to cache and refetch.
export function useAnalyticsQueryMutation() {
  return useMutation({
    mutationFn: async (body: AnalyticsQuery) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: AnalyticsAnswer }>(
        "/analytics/query",
        body,
      );
      return unwrap(res.data);
    },
  });
}
