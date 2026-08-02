import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Budget } from "@/features/budgets/types";

async function fetchBudget(budgetId: string): Promise<Budget> {
  const { data } = await apiClient.get<ApiEnvelope<Budget>>(`/budgets/${budgetId}`);
  return unwrap(data);
}

export function useBudgetQuery(budgetId: string) {
  return useQuery({
    queryKey: ["budgets", budgetId],
    queryFn: () => fetchBudget(budgetId),
  });
}
