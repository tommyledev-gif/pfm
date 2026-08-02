import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Budget } from "@/features/budgets/types";

async function deleteBudget(budgetId: string): Promise<Budget> {
  const { data } = await apiClient.delete<ApiEnvelope<Budget>>(`/budgets/${budgetId}`);
  return unwrap(data);
}

// Not idempotent (spec.md US-05 Idempotency note) — a second delete on the
// same id 404s. No optimistic update; the list/detail queries are
// invalidated on success.
export function useDeleteBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: (_, budgetId) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets", budgetId] });
    },
  });
}
