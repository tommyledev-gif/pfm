import { useCallback, useState } from "react";

import { useBulkCreateBudgetsMutation } from "@/features/budget-wizard/api/use-bulk-create-budgets-mutation";
import { useCreateCategoryMutation } from "@/features/categories/api/use-create-category-mutation";
import { BudgetProposalsResponse } from "@/features/budget-wizard/types";
import { getErrorMessage } from "@/lib/api-envelope";

interface SubmitInputs {
  result: BudgetProposalsResponse | null;
  currency: string;
  /** Placeholder id → name, for categories that do not exist on the server. */
  pendingCategories: Record<string, string>;
}

/**
 * The wizard's one and only write.
 *
 * ⚠️ Everything else in the wizard is draft state; this is the moment it
 * becomes real, which is why it lives on its own. Two things happen here in
 * order, and the order matters:
 *
 *   1. Categories the user invented are created HERE, not when they were
 *      typed — backing out of the wizard must leave the account exactly as it
 *      was found, with no stray category behind.
 *   2. The budgets are written in bulk, which REPLACES the account's entire
 *      active budget set. The caller is responsible for having confirmed that
 *      with the user first.
 *
 * Amounts are integer cents and are passed through untouched.
 */
export function useWizardSubmit() {
  const bulkCreate = useBulkCreateBudgetsMutation();
  const createCategory = useCreateCategoryMutation();
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const submit = useCallback(
    async ({ result, currency, pendingCategories }: SubmitInputs): Promise<{ count: number } | { error: string }> => {
      if (!result) return { error: "" };
      try {
        const idByPlaceholder: Record<string, string> = {};
        for (const [placeholder, name] of Object.entries(pendingCategories)) {
          // Skip a placeholder whose row the user removed before submitting.
          if (!result.proposals.some((p) => p.category_id === placeholder)) continue;
          const created = await createCategory.mutateAsync({ name, type: "expense" });
          idByPlaceholder[placeholder] = created.id;
        }

        const data = await bulkCreate.mutateAsync({
          budgets: result.proposals.map((p) => ({
            category_id: idByPlaceholder[p.category_id] ?? p.category_id,
            period: "monthly" as const,
            limits: [{ currency, amount_limit: p.amount_max }],
          })),
        });
        setCreatedCount(data.created_count);
        return { count: data.created_count };
      } catch (e) {
        return { error: getErrorMessage(e, "Chưa lưu được ngân sách. Thử lại.") };
      }
    },
    [bulkCreate, createCategory],
  );

  return { submit, createdCount, resetCreatedCount: () => setCreatedCount(null), submitting: bulkCreate.isPending };
}
