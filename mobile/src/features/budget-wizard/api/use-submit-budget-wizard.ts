import { useState } from "react";

import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { useBulkCreateBudgetsMutation } from "@/features/budget-wizard/api/use-bulk-create-budgets-mutation";
import { BudgetWizardPeriod, BulkBudgetItem, PendingCustomCategory, WizardSelection } from "@/features/budget-wizard/types";
import { WalletCurrency } from "@/lib/constants";

// Implements US-05 Main Flow steps 2-3 (specs/ai-budget-wizard/spec.md): any
// pending custom Category is created first, sequentially, one at a time —
// if any single creation fails, this stops immediately and POST
// /budgets/bulk is never called at all (Edge Cases #2/S-BWZ-26). A Category
// that *did* succeed before a later failure is deliberately not rolled
// back — it already exists as a real Category, independent of this attempt.
export function useSubmitBudgetWizard() {
  const createCategory = useCreateCategoryMutation();
  const bulkCreate = useBulkCreateBudgetsMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (
    selections: WizardSelection[],
    amounts: Record<string, number>,
    period: BudgetWizardPeriod,
    currency: WalletCurrency,
    customCategories: PendingCustomCategory[],
  ): Promise<number> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const resolvedIds = new Map<string, string>();
      for (const pending of customCategories) {
        const created = await createCategory.mutateAsync({ name: pending.name, icon: pending.icon, type: pending.type });
        resolvedIds.set(pending.clientId, created.id);
      }

      const budgets: BulkBudgetItem[] = selections.map((s) => ({
        category_id: resolvedIds.get(s.categoryId) ?? s.categoryId,
        period,
        limits: [{ currency, amount_limit: amounts[s.categoryId] ?? 0 }],
      }));

      const result = await bulkCreate.mutateAsync({ budgets });
      return result.created_count;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, error };
}
