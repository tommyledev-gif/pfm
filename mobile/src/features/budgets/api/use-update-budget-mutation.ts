import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Budget } from "@/features/budgets/types";
import { WalletCurrency } from "@/lib/constants";

// Full replacement of all currency limits, never a merge — backend's
// UpdateBudgetRequest doesn't accept category_id/period/start_date
// (strict-decoded). icon/icon_url are independent of `limits`
// (specs/wallet-budget-icons/spec.md Edge Case US-04 #2) — omitting `limits`
// here leaves the Budget's existing currency entries untouched.
export interface UpdateBudgetRequest {
  limits?: Partial<Record<WalletCurrency, number>>;
  icon?: string;
  icon_url?: string;
}

export function useUpdateBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateBudgetRequest }) => {
      const res = await apiClient.patch<{ success: boolean; message: string; data?: Budget }>(
        `/budgets/${id}`,
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
