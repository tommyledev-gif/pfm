import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { BudgetProposalsRequest, BudgetProposalsResponse } from "@/features/budget-wizard/types";

// POST /ai/budget-proposals (specs/ai-budget-wizard/spec.md US-04) — a pure
// function of its input (rule-based, computed entirely in the Go Backend),
// safe to call again if the User changes an earlier step.
export function useBudgetProposalsMutation() {
  return useMutation({
    mutationFn: async (body: BudgetProposalsRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: BudgetProposalsResponse }>(
        "/ai/budget-proposals",
        body,
      );
      return unwrap(res.data);
    },
  });
}
