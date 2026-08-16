import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Category } from "@/features/categories/types";
import { CategoryType } from "@/lib/constants";

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  type: CategoryType;
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCategoryRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: Category }>(
        "/categories/",
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
