import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Budget, CreateBudgetRequest } from "@/features/budgets/types";

export function useCreateBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBudgetRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: Budget }>("/budgets/", body);
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
