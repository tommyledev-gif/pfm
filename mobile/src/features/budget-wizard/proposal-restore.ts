import { applyKeptCategories, KeptPlanShape } from "@/features/budget-wizard/hooks/use-wizard-kept-categories";
import { SavedBudgetPlan, SavedPlanRow, applySavedPlanRows } from "@/features/budget-wizard/saved-plan";
import { BudgetProposalsResponse, PresetKey } from "@/features/budget-wizard/types";

export interface RestoreContext {
  /** Rows from an explicitly saved plan, pending their first application. */
  pendingSavedRows: SavedPlanRow[] | null;
  restoredFrom: SavedBudgetPlan | null;
  /** In-session carry-over from a step-back. Categories only, never amounts. */
  keptPlan: KeptPlanShape | null;
  chosenPreset: PresetKey;
}

export interface RestoredProposal {
  response: BudgetProposalsResponse;
  /** Set only on the saved-plan path, which also restores which rows were the
   *  user's own and which categories still need creating. */
  addedIds?: string[];
  pendingCategories?: Record<string, string>;
}

/**
 * Which of the three things a fresh proposal becomes.
 *
 * Pure, and separate from the request that produced it, because the choice is
 * the subtle part and it reads badly buried inside an async callback.
 *
 * ⚠️ A saved plan's hand-edits only make sense against the preset they were
 * made under. A different profile is a different set of rows, and pasting last
 * month's figures onto it would silently overrule an allocation the user has
 * just asked for — so the saved path is taken only on a matching preset.
 */
export function restoreProposal(
  data: BudgetProposalsResponse,
  { pendingSavedRows, restoredFrom, keptPlan, chosenPreset }: RestoreContext,
): RestoredProposal {
  if (pendingSavedRows && pendingSavedRows.length > 0 && restoredFrom?.preset === chosenPreset) {
    return {
      response: applySavedPlanRows(data, pendingSavedRows),
      addedIds: pendingSavedRows.filter((row) => row.added).map((row) => row.category_id),
      pendingCategories: Object.fromEntries(
        pendingSavedRows
          .filter((row) => row.pendingName)
          .map((row) => [row.category_id, row.pendingName as string]),
      ),
    };
  }

  if (keptPlan) {
    // ⚠️ A diff over the fresh proposal — every amount is whatever the
    // allocator just computed for the new answers, never the old ones.
    return { response: applyKeptCategories(data, keptPlan) };
  }

  return { response: data };
}
