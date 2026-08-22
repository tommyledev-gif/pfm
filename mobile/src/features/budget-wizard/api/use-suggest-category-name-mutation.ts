import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SuggestCategoryNameRequest, SuggestCategoryNameResponse } from "@/features/budget-wizard/types";

// POST /ai/suggest-category-name (specs/ai-budget-wizard/spec.md US-03 Step
// 2B) — never creates anything, a pure suggestion call.
export function useSuggestCategoryNameMutation() {
  return useMutation({
    mutationFn: async (body: SuggestCategoryNameRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: SuggestCategoryNameResponse }>(
        "/ai/suggest-category-name",
        body,
      );
      return unwrap(res.data);
    },
  });
}
