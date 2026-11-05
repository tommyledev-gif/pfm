import { Dispatch, SetStateAction, useCallback } from "react";

import { AddBudgetRowResult } from "@/features/budget-wizard/components/AddBudgetRowModal";
import { withAddedRow, withEditedAmount, withRemovedRow } from "@/features/budget-wizard/proposal-edits";
import { BudgetProposalsResponse } from "@/features/budget-wizard/types";

interface WizardRowEditState {
  setResult: Dispatch<SetStateAction<BudgetProposalsResponse | null>>;
  setAddedIds: Dispatch<SetStateAction<string[]>>;
  setRemovedIds: Dispatch<SetStateAction<string[]>>;
  setPendingCategories: Dispatch<SetStateAction<Record<string, string>>>;
  setAddRowOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * The result screen's row edits: an amount set by hand, a row added, a row
 * removed. Split out of useBudgetWizardState for the 300-line limit; the
 * state they change stays there.
 */
export function useWizardRowEdits({
  setResult,
  setAddedIds,
  setRemovedIds,
  setPendingCategories,
  setAddRowOpen,
}: WizardRowEditState) {
  /**
   * A hand-edited row.
   *
   * ⚠️ Applied locally and ONLY to the row that was edited — the buffer absorbs
   * the difference and every other row is left untouched. Re-asking the server
   * would re-run the allocator, which would rebalance rows the user did not
   * touch: exactly the silent rewrite the edit modal's ceiling exists to
   * prevent. The transform itself lives in proposal-edits.ts.
   */
  const editAmount = useCallback((categoryId: string, amountXu: number) => {
    setResult((prev) => (prev ? withEditedAmount(prev, categoryId, amountXu) : prev));
  }, [setResult]);

  const addProposalRow = useCallback((entry: AddBudgetRowResult) => {
    const tempId = entry.categoryId ?? `new:${Date.now()}`;
    if (!entry.categoryId) setPendingCategories((prev) => ({ ...prev, [tempId]: entry.name }));
    setResult((prev) => (prev ? withAddedRow(prev, tempId, entry.name, entry.amountXu) : prev));
    setAddedIds((prev) => (prev.includes(tempId) ? prev : [...prev, tempId]));
    setAddRowOpen(false);
  }, [setPendingCategories, setResult, setAddedIds, setAddRowOpen]);

  const removeProposalRow = useCallback((categoryId: string) => {
    setResult((prev) => (prev ? withRemovedRow(prev, categoryId) : prev));
    setAddedIds((prev) => prev.filter((id) => id !== categoryId));
    // Recorded so a step-back that keeps the plan does not resurrect it.
    setRemovedIds((prev) => (prev.includes(categoryId) ? prev : [...prev, categoryId]));
    setPendingCategories((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }, [setResult, setAddedIds, setRemovedIds, setPendingCategories]);

  return { editAmount, addProposalRow, removeProposalRow };
}
