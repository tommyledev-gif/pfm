import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { Budget } from "@/features/budgets/types";

// Same double-wrap as wallets/categories: `dto.NewListBudgetsResponse` is
// itself `{data: [...]}`, nested inside the envelope's `data` field.
//
// Exported separately (not just inlined in useBudgetsQuery's queryFn) so
// check-budget-limit.ts can force a fresh fetch via queryClient.fetchQuery
// right after a transaction is created — invalidateQueries alone only
// refetches queries with an active observer, which the budgets screen isn't
// while the user is on ai-chat or the manual-entry form.
export async function fetchBudgets(): Promise<Budget[]> {
  const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Budget[] } }>("/budgets/");
  return unwrap(res.data).data;
}

export function useBudgetsQuery() {
  return useQuery({ queryKey: ["budgets"], queryFn: fetchBudgets, staleTime: SNAPSHOT_STALE_TIME_MS });
}
