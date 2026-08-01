import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { CategoryType } from "@/lib/constants";
import type { ListCategoriesResult } from "@/features/categories/types";

async function fetchCategories(type?: CategoryType): Promise<ListCategoriesResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListCategoriesResult>>("/categories", {
    params: type ? { type } : undefined,
  });
  return unwrap(data);
}

export function useCategoriesQuery(type?: CategoryType) {
  return useQuery({
    queryKey: ["categories", type ?? "all"],
    queryFn: () => fetchCategories(type),
  });
}
