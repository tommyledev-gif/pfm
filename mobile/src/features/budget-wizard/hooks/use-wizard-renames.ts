import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { Category } from "@/features/categories/types";
import { BudgetProposalsResponse } from "@/features/budget-wizard/types";

/** What renaming a result row does to its category (EditAmountModal). */
export type RowNameKind = "new" | "own" | "system";

interface UseWizardRenamesOptions {
  setResult: Dispatch<SetStateAction<BudgetProposalsResponse | null>>;
  pendingCategories: Record<string, string>;
  setPendingCategories: Dispatch<SetStateAction<Record<string, string>>>;
}

/**
 * Renaming a row of the result screen, as draft state like the rest of the
 * wizard: nothing is written until the final confirmation (use-wizard-submit).
 *
 *   - A category the wizard is about to create simply gets created with the
 *     new name.
 *   - One of the User's own categories is renamed on save, everywhere.
 *   - A built-in category is not renamable. A renamed copy would be a new
 *     category: transactions already filed, and the ones the assistant files
 *     from now on, would keep landing in the built-in one, and the budget on
 *     the copy would sit at nothing spent.
 */
export function useWizardRenames({ setResult, pendingCategories, setPendingCategories }: UseWizardRenamesOptions) {
  // Own category id → its new name, applied at submit.
  const [renamedCategories, setRenamedCategories] = useState<Record<string, string>>({});

  const nameKind = useCallback(
    (categoryId: string, categories: Category[]): RowNameKind => {
      if (categoryId in pendingCategories) return "new";
      const category = categories.find((c) => c.id === categoryId);
      return category && category.user_id !== null ? "own" : "system";
    },
    [pendingCategories],
  );

  const renameRow = useCallback(
    (categoryId: string, name: string, kind: RowNameKind) => {
      if (kind === "system") return;
      setResult((prev) =>
        prev
          ? {
              ...prev,
              proposals: prev.proposals.map((p) => (p.category_id === categoryId ? { ...p, category_name: name } : p)),
            }
          : prev,
      );
      if (kind === "new") setPendingCategories((prev) => ({ ...prev, [categoryId]: name }));
      else setRenamedCategories((prev) => ({ ...prev, [categoryId]: name }));
    },
    [setResult, setPendingCategories],
  );

  // Back to none, or to a saved plan's renames when it is restored.
  const resetRenames = useCallback((next?: Record<string, string>) => setRenamedCategories(next ?? {}), []);

  return { renamedCategories, nameKind, renameRow, resetRenames };
}
