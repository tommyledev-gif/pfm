import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Budget, CreateBudgetRequest } from "@/features/budgets/types";

async function createBudget(req: CreateBudgetRequest): Promise<Budget> {
  const { data } = await apiClient.post<ApiEnvelope<Budget>>("/budgets", req);
  return unwrap(data);
}

// Not idempotent (spec.md US-01 Idempotency note) — no key; the
// duplicate-active-Budget check is a business rule, not a formal
// idempotency mechanism.
export function useCreateBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
