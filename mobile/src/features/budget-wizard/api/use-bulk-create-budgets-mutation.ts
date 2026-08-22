import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { BulkCreateBudgetsRequest, BulkCreateBudgetsResponse } from "@/features/budget-wizard/types";

// POST /budgets/bulk (specs/ai-budget-wizard/spec.md US-05) — replaces the
// caller's entire active Budget set, not a merge (Edge Cases #1).
export function useBulkCreateBudgetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BulkCreateBudgetsRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: BulkCreateBudgetsResponse }>(
        "/budgets/bulk",
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["report-summary"] });
    },
  });
}
