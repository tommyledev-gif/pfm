import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { colorForCategory } from "@/lib/category-color";
import { BudgetRow } from "@/features/budgets/hooks/use-budget-rows";
import { categoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";

/**
 * The categories of the budgets on screen, one entry each, for the category
 * picker a held row opens (split out of BudgetsTab for the 300-line cap).
 */
export function useBudgetPickerCategories(rows: BudgetRow[], categoryById: Map<string, Category>) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      Array.from(new Map(rows.map(({ budget }) => [budget.category_id, budget])).values()).map((budget) => ({
        id: budget.category_id,
        name: categoryLabel(categoryById.get(budget.category_id), budget.category_name),
        icon: budget.icon ?? categoryById.get(budget.category_id)?.icon,
        iconUrl: budget.icon_url ?? categoryById.get(budget.category_id)?.icon_url,
        color: colorForCategory(budget.category_id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t: category names follow a language switch
    [rows, categoryById, t],
  );
}
