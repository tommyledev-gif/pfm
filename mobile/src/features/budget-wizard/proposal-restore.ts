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
  /** Every category the User has now (the prefill's); null while unknown. */
  categoryIds: ReadonlySet<string> | null;
}

export interface RestoredProposal {
  response: BudgetProposalsResponse;
  /** Set only on the saved-plan path, which also restores which rows were the
   *  user's own, which categories still need creating, which were renamed,
   *  and which of the server's rows the user had removed. */
  addedIds?: string[];
  pendingCategories?: Record<string, string>;
  renamedCategories?: Record<string, string>;
  removedIds?: string[];
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
  { pendingSavedRows, restoredFrom, keptPlan, chosenPreset, categoryIds }: RestoreContext,
): RestoredProposal {
  if (pendingSavedRows && pendingSavedRows.length > 0 && restoredFrom?.preset === chosenPreset) {
    const renamedCategories = restoredFrom.renamedCategories ?? {};
    const response = applySavedPlanRows(data, pendingSavedRows, categoryIds, renamedCategories);
    const kept = new Set(response.proposals.map((p) => p.category_id));
    return {
      response,
      addedIds: pendingSavedRows.filter((row) => row.added && kept.has(row.category_id)).map((row) => row.category_id),
      pendingCategories: Object.fromEntries(
        pendingSavedRows
          .filter((row) => row.pendingName)
          .map((row) => [row.category_id, row.pendingName as string]),
      ),
      renamedCategories,
      // The server's rows the plan left out were removed by the user before
      // saving: recorded as such, so a step-back that keeps the plan does not
      // bring them back either.
      removedIds: data.proposals.filter((p) => !kept.has(p.category_id)).map((p) => p.category_id),
    };
  }

  if (keptPlan) {
    // ⚠️ A diff over the fresh proposal — every amount is whatever the
    // allocator just computed for the new answers, never the old ones.
    return { response: applyKeptCategories(data, keptPlan) };
  }

  return { response: data };
}
