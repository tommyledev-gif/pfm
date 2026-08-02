import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ListBudgetsResult } from "@/features/budgets/types";

async function fetchBudgets(): Promise<ListBudgetsResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListBudgetsResult>>("/budgets");
  return unwrap(data);
}

export function useBudgetsQuery() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: fetchBudgets,
  });
}
