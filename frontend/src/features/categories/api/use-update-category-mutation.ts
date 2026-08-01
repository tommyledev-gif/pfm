import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Category, UpdateCategoryRequest } from "@/features/categories/types";

interface UpdateCategoryVariables {
  categoryId: string;
  req: UpdateCategoryRequest;
}

async function updateCategory({ categoryId, req }: UpdateCategoryVariables): Promise<Category> {
  const { data } = await apiClient.patch<ApiEnvelope<Category>>(`/categories/${categoryId}`, req);
  return unwrap(data);
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategory,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", variables.categoryId] });
    },
  });
}
