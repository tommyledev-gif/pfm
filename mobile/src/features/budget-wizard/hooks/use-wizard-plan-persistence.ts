import { useCallback } from "react";

import { SavingsChoice } from "@/features/budget-wizard/budget-math";
import { FixedCostItem } from "@/features/budget-wizard/fixed-costs";
import { SavedBudgetPlan, useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { BudgetProposalsResponse, PresetKey } from "@/features/budget-wizard/types";

interface PlanSnapshotInputs {
  result: BudgetProposalsResponse | null;
  currency: string;
  /** xu. */
  income: number;
  fixed: number;
  fixedCostsText: string;
  fixedCostsSuggested: FixedCostItem[];
  savingsChoice: SavingsChoice;
  cycleStartDay: number;
  preset: PresetKey | null;
  addedIds: string[];
  pendingCategories: Record<string, string>;
}

/**
 * Keeping a wizard run for next time.
 *
 * Split out of the wizard's state hook so that file stays within the 300-line
 * limit. ⚠️ This is the persisted, explicit "save this plan" feature and it
 * does keep amounts — distinct from the in-session step-back continuity in
 * use-wizard-kept-categories, which deliberately keeps none. The two never
 * read each other.
 */
export function useWizardPlanPersistence(onSaved: () => void) {
  /**
   * The plan as it stands, in the shape the store keeps.
   *
   * Built at save time from live state, not accumulated as the user goes: a
   * half-written copy updated on every keystroke is a second source of truth
   * for the same answers, and it would be the stale one exactly when it
   * mattered.
   */
  const buildSavedPlan = useCallback((inputs: PlanSnapshotInputs): SavedBudgetPlan | null => {
    if (!inputs.result) return null;
    return {
      savedAt: new Date().toISOString(),
      currency: inputs.currency,
      income: inputs.income,
      fixed: inputs.fixed,
      fixedCostsText: inputs.fixedCostsText,
      fixedCostsSuggested: inputs.fixedCostsSuggested,
      savingsChoice: inputs.savingsChoice,
      cycleStartDay: inputs.cycleStartDay,
      preset: inputs.preset,
      rows: inputs.result.proposals.map((p) => ({
        category_id: p.category_id,
        category_name: p.category_name,
        amountXu: p.amount_max,
        added: inputs.addedIds.includes(p.category_id),
        pendingName: inputs.pendingCategories[p.category_id],
      })),
    };
  }, []);

  const savePlan = useCallback(
    (inputs: PlanSnapshotInputs) => {
      const plan = buildSavedPlan(inputs);
      if (!plan) return;
      useSavedBudgetPlanStore.getState().savePlan(plan);
      onSaved();
    },
    [buildSavedPlan, onSaved],
  );

  const clearStoredPlan = useCallback(() => useSavedBudgetPlanStore.getState().clearPlan(), []);

  return { savePlan, clearStoredPlan };
}
