import { useMemo } from "react";

import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";

/**
 * The User's Categories keyed by id — for a view that only carries a
 * category_id and needs the Category's own icon to draw the same tile it has
 * everywhere else. Reads the shared categories query (already cached by any
 * screen that lists them), so it costs no request of its own.
 */
export function useCategoryLookup(): Map<string, Category> {
  const { data } = useCategoriesQuery();
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
}
