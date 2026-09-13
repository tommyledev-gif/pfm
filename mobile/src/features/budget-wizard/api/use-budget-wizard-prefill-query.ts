import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { BudgetWizardPrefill } from "@/features/budget-wizard/types";

// GET /ai/budget-wizard/prefill — currency, the four lifestyle presets, the
// user's visible categories and any budgets they already have.
//
// Lazily enabled: nothing is fetched until the wizard is actually opened, so a
// user who never taps the quick action never pays for this.
export function useBudgetWizardPrefillQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["budget-wizard-prefill"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: BudgetWizardPrefill }>(
        "/ai/budget-wizard/prefill",
      );
      return unwrap(res.data);
    },
    enabled,
  });
}
