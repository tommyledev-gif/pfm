import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Category } from "@/features/categories/types";

// No `type` field — backend's UpdateCategoryRequest is strict-decoded, a
// category's type can't change after creation.
export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  icon_url?: string;
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateCategoryRequest }) => {
      const res = await apiClient.patch<{ success: boolean; message: string; data?: Category }>(
        `/categories/${id}`,
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
