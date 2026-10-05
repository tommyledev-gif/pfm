import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { Category } from "@/features/categories/types";
import { CategoryType } from "@/lib/constants";

// Same double-wrap as wallets/budgets: `dto.NewListCategoriesResponse` is
// itself `{data: [...]}`, nested inside the envelope's `data` field.
//
// One cache entry for every caller: a typed list is filtered out of the full
// one here rather than fetched as `?type=` under its own key. Separate keys
// meant the expense/income lists were only ever saved for offline use once
// that exact list had been loaded online — Home loads the full list on every
// launch, but a sheet opened offline before its typed list was ever fetched
// (or after that entry aged out while the full one kept refreshing) had no
// categories to pick. The backend's `type` filter is an exact match that
// leaves its ordering untouched, so filtering here returns the same rows.
export function useCategoriesQuery(type?: CategoryType) {
  // Stable per type, so TanStack keeps the filtered array between renders
  // instead of handing every render a new one.
  const select = useCallback(
    (categories: Category[]) => (type ? categories.filter((c) => c.type === type) : categories),
    [type],
  );
  return useQuery({
    // The key the full list always had, so the copy already saved on the
    // device keeps serving offline straight after this update.
    queryKey: ["categories", { type: undefined }],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Category[] } }>(
        "/categories/",
      );
      return unwrap(res.data).data;
    },
    select,
    staleTime: SNAPSHOT_STALE_TIME_MS,
  });
}
