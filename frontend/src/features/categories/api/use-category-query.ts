import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Category } from "@/features/categories/types";

async function fetchCategory(categoryId: string): Promise<Category> {
  const { data } = await apiClient.get<ApiEnvelope<Category>>(`/categories/${categoryId}`);
  return unwrap(data);
}

export function useCategoryQuery(categoryId: string) {
  return useQuery({
    queryKey: ["categories", categoryId],
    queryFn: () => fetchCategory(categoryId),
  });
}
