import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Category } from "@/features/categories/types";

async function deleteCategory(categoryId: string): Promise<Category> {
  const { data } = await apiClient.delete<ApiEnvelope<Category>>(`/categories/${categoryId}`);
  return unwrap(data);
}

// Not idempotent (spec.md US-05 Idempotency note) — a second delete on the
// same id 404s, unlike F-03's set-default. No optimistic update here; the
// list/detail queries are invalidated on success.
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", categoryId] });
    },
  });
}
