import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { BudgetWizardPrefillResponse } from "@/features/budget-wizard/types";

// GET /ai/budget-wizard/prefill (specs/ai-budget-wizard/spec.md US-01) —
// lazily enabled, only fetched once the wizard is actually opened (US-02
// Main Flow step 5: "prefill loads at this point, not before").
export function useBudgetWizardPrefillQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["budget-wizard-prefill"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: BudgetWizardPrefillResponse }>(
        "/ai/budget-wizard/prefill",
      );
      return unwrap(res.data);
    },
    enabled,
  });
}
