import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { BulkCreateBudgetsRequest, BulkCreateBudgetsResponse } from "@/features/budget-wizard/types";

// POST /budgets/bulk — replaces the caller's entire active budget set in one
// transaction. A replace, not a merge: the wizard describes a whole plan, and
// merging it into whatever was there before produces a set the user never
// reviewed.
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
