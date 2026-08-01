import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Category, CreateCategoryRequest } from "@/features/categories/types";

async function createCategory(req: CreateCategoryRequest): Promise<Category> {
  const { data } = await apiClient.post<ApiEnvelope<Category>>("/categories", req);
  return unwrap(data);
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
