import { useMemo } from "react";

import { SavingsChoice } from "@/features/budget-wizard/budget-math";
import { FixedCostItem } from "@/features/budget-wizard/fixed-costs";
import { SavedBudgetPlan, planSignature } from "@/features/budget-wizard/saved-plan";
import { newPlanId, useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan-store";
import { BudgetProposalsResponse, PresetKey } from "@/features/budget-wizard/types";
import { useLatestCallback } from "@/lib/use-latest-callback";

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
  renamedCategories: Record<string, string>;
}

/**
 * The plan as it stands, in the shape the store keeps.
 *
 * Built from live state when it is needed, not accumulated as the user goes:
 * a half-written copy updated on every keystroke is a second source of truth
 * for the same answers, and it would be the stale one exactly when it mattered.
 */
function buildSavedPlan(inputs: PlanSnapshotInputs, id: string, savedAt: string): SavedBudgetPlan | null {
  if (!inputs.result) return null;
  const onPlan = new Set(inputs.result.proposals.map((p) => p.category_id));
  return {
    id,
    savedAt,
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
      manual: p.source === "manual",
    })),
    // Only renames whose row is still on the plan: the confirm skips the rest.
    renamedCategories: Object.fromEntries(
      Object.entries(inputs.renamedCategories).filter(([id]) => onPlan.has(id)),
    ),
  };
}

/**
 * Keeping a wizard run for next time.
 *
 * Split out of the wizard's state hook so that file stays within the 300-line
 * limit. ⚠️ This is the persisted, explicit "save this plan" feature and it
 * does keep amounts — distinct from the in-session step-back continuity in
 * use-wizard-kept-categories, which deliberately keeps none. The two never
 * read each other.
 *
 * ⚠️ `planSaved` is whether the screen says the same thing as one of the kept
 * plans, not whether the button was pressed this run. As a flag set on save,
 * it left the button reading "saved" (and disabled) through every edit made
 * after it, so those edits could never be kept; and a plan reopened unchanged
 * offered to save itself again.
 *
 * Saving adds a plan to the list: the one this run started from stays as it
 * was (saved-plan-store).
 */
export function useWizardPlanPersistence(inputs: PlanSnapshotInputs) {
  const storedPlans = useSavedBudgetPlanStore((s) => s.plans);
  const storedSignatures = useMemo(() => new Set(storedPlans.map(planSignature)), [storedPlans]);
  // Rebuilt per render rather than memoized on a dozen inputs: a handful of
  // rows, serialised, costs less than keeping that dependency list right.
  const current = buildSavedPlan(inputs, "", "");
  const planSaved = current !== null && storedSignatures.has(planSignature(current));

  const savePlan = useLatestCallback(() => {
    const plan = buildSavedPlan(inputs, newPlanId(), new Date().toISOString());
    if (plan) useSavedBudgetPlanStore.getState().savePlan(plan);
  });

  return { savePlan, planSaved };
}
