import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Budget } from "@/features/budgets/types";

// Same double-wrap as wallets/categories: `dto.NewListBudgetsResponse` is
// itself `{data: [...]}`, nested inside the envelope's `data` field.
export function useBudgetsQuery() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Budget[] } }>("/budgets/");
      return unwrap(res.data).data;
    },
  });
}
