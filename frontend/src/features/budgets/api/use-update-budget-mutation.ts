import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Budget, UpdateBudgetRequest } from "@/features/budgets/types";

interface UpdateBudgetVariables {
  budgetId: string;
  req: UpdateBudgetRequest;
}

async function updateBudget({ budgetId, req }: UpdateBudgetVariables): Promise<Budget> {
  const { data } = await apiClient.patch<ApiEnvelope<Budget>>(`/budgets/${budgetId}`, req);
  return unwrap(data);
}

export function useUpdateBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBudget,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budgets", variables.budgetId] });
    },
  });
}
