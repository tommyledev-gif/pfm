import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Category } from "@/features/categories/types";
import { CategoryType } from "@/lib/constants";

// Same double-wrap as wallets/budgets: `dto.NewListCategoriesResponse` is
// itself `{data: [...]}`, nested inside the envelope's `data` field.
export function useCategoriesQuery(type?: CategoryType) {
  return useQuery({
    queryKey: ["categories", { type }],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Category[] } }>(
        "/categories/",
        { params: type ? { type } : undefined },
      );
      return unwrap(res.data).data;
    },
  });
}
