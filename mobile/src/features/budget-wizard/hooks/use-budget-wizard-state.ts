import { useCallback, useEffect, useMemo, useState } from "react";

import { useBudgetProposalsMutation } from "@/features/budget-wizard/api/use-budget-proposals-mutation";
import { useBudgetWizardPrefillQuery } from "@/features/budget-wizard/api/use-budget-wizard-prefill-query";
import { useWizardRenames } from "@/features/budget-wizard/hooks/use-wizard-renames";
import {
  DEFAULT_SAVINGS_CHOICE,
  SavingsChoice,
  disposableXu,
  savingsAmount,
  validateIncomeStep,
} from "@/features/budget-wizard/budget-math";
import { useWizardFixedCosts } from "@/features/budget-wizard/hooks/use-wizard-fixed-costs";
import { SavedBudgetPlan, SavedPlanRow } from "@/features/budget-wizard/saved-plan";
import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan-store";
import { useWizardPlanPersistence } from "@/features/budget-wizard/hooks/use-wizard-plan-persistence";
import { useWizardSubmit } from "@/features/budget-wizard/hooks/use-wizard-submit";
import { useWizardRowEdits } from "@/features/budget-wizard/hooks/use-wizard-row-edits";
import { PROBLEM_MESSAGES, resolvePresetIntents } from "@/features/budget-wizard/preset-intents";
import { useWizardKeptCategories } from "@/features/budget-wizard/hooks/use-wizard-kept-categories";
import { useWizardStepBack } from "@/features/budget-wizard/hooks/use-wizard-step-back";
import { restoreProposal } from "@/features/budget-wizard/proposal-restore";
import { BudgetProposalsResponse, CategoryIntentRequest, PresetKey } from "@/features/budget-wizard/types";
import { errorText } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";
import { useLatestCallback } from "@/lib/use-latest-callback";

export const BUDGET_WIZARD_TOTAL_STEPS = 3;

// ⚠️ A plan with no rows must never be submitted: confirming replaces the
// account's entire active budget set, so an empty plan would silently wipe
// every budget the user has.
const MIN_PLAN_ROWS = 1;

/**
 * All of the wizard's state and transitions, kept out of the modal so that file
 * stays layout only.
 *
 * ⚠️ This state is DRAFT INPUT, not a copy of server data — which is why it
 * lives in useState rather than TanStack Query. The prefill response, the
 * proposal and the created budgets are all server state and are never copied
 * into here; what is here is what the user has typed and not yet committed.
 *
 * Nothing is written at any step before the final confirmation. Dismissing the
 * wizard half way leaves budgets, categories and plans exactly as they were.
 */
export function useBudgetWizardState(visible: boolean, onClose: () => void, onCompleted?: (count: number) => void) {
  const [step, setStep] = useState(1);

  // Every amount here is xu.
  const [income, setIncome] = useState(0);
  const [savingsChoice, setSavingsChoice] = useState<SavingsChoice>(DEFAULT_SAVINGS_CHOICE);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [preset, setPreset] = useState<PresetKey | null>(null);

  const [result, setResult] = useState<BudgetProposalsResponse | null>(null);
  // Rows the user added by hand on the result screen. Every row is removable
  // now, so this no longer gates that — it records which rows are the user's
  // own, for the saved-plan shape and for re-adding them after a step-back.
  const [addedIds, setAddedIds] = useState<string[]>([]);
  // Categories that do not exist yet, keyed by the placeholder id their row
  // carries. ⚠️ NOT created here: the wizard writes nothing before the final
  // confirmation, so a user who backs out leaves no stray category behind.
  // submit() creates them first and swaps the placeholders for real ids.
  const [pendingCategories, setPendingCategories] = useState<Record<string, string>>({});
  const renames = useWizardRenames({ setResult, pendingCategories, setPendingCategories });
  const [error, setError] = useState<string | null>(null);
  // Set when this run was seeded from a saved plan: the banner on screen 1
  // reads it, and the amounts are re-applied once the server's proposal for the
  // saved preset comes back (see applySavedRows).
  const [restoredFrom, setRestoredFrom] = useState<SavedBudgetPlan | null>(null);
  const [pendingSavedRows, setPendingSavedRows] = useState<SavedPlanRow[] | null>(null);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  // Suggested rows the user removed. Held apart from addedIds because the two
  // answer different questions: which rows are the user's own, and which of
  // the allocator's rows they rejected.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const keptCategories = useWizardKeptCategories();

  // The fixed-cost field and its breakdown, which must always agree.
  const fixedCosts = useWizardFixedCosts();
  const fixed = fixedCosts.fixed;

  const savedPlan = useSavedBudgetPlanStore((s) => s.plan);
  const savedPlanHydrated = useSavedBudgetPlanStore((s) => s.hydrated);

  const prefill = useBudgetWizardPrefillQuery(visible);
  const proposals = useBudgetProposalsMutation();
  const commit = useWizardSubmit();

  const currency = prefill.data?.currency ?? "VND";
  const savings = savingsAmount(savingsChoice, income);
  const disposable = disposableXu(income, fixed, savings);

  // Reset on every open. A wizard that reopens holding the previous run's
  // half-finished figures looks like it saved something it did not.
  //
  // ⚠️ A SAVED plan is the one exception, and it is not the same thing: those
  // figures were explicitly kept by the user for exactly this moment, and the
  // banner on screen 1 says where they came from and offers to drop them. An
  // unsaved half-run still starts from zero.
  //
  // Waits for the persisted store to have been read back — treating "storage
  // has not resolved yet" as "nothing saved" would blank a plan on a cold
  // launch, which is the one launch where the user is most likely to be
  // reaching for it.
  //
  // startFrom is also how a run switches to another kept plan (the saved-plans
  // list) and how "Bắt đầu lại" empties it (null). It only reads the plan:
  // nothing here changes or removes a kept one.
  const startFrom = useLatestCallback((plan: SavedBudgetPlan | null) => {
    setStep(1);
    setIncome(plan?.income ?? 0);
    setSavingsChoice(
      plan?.savingsChoice ??
        (prefill.data?.default_savings_pct !== undefined
          ? { kind: "pct", pct: prefill.data.default_savings_pct }
          : DEFAULT_SAVINGS_CHOICE),
    );
    fixedCosts.reset(
      plan ? { fixed: plan.fixed, text: plan.fixedCostsText, suggested: plan.fixedCostsSuggested } : undefined,
    );
    setAddRowOpen(false);
    setCycleStartDay(plan?.cycleStartDay ?? prefill.data?.cycle_start_day ?? 1);
    setPreset(plan?.preset ?? null);
    setResult(null);
    setAddedIds([]);
    setPendingCategories({});
    renames.resetRenames();
    commit.resetCreatedCount();
    setError(null);
    setRestoredFrom(plan ?? null);
    setPendingSavedRows(plan?.rows ?? null);
    setOverwriteConfirmOpen(false);
    setRemovedIds([]);
    keptCategories.forget();
  });
  useEffect(() => {
    if (visible && savedPlanHydrated) startFrom(useSavedBudgetPlanStore.getState().plan);
  }, [visible, savedPlanHydrated, startFrom]);

  const intentsForPreset = useCallback(
    (key: PresetKey) => resolvePresetIntents(prefill.data, key),
    [prefill.data],
  );

  const requestProposal = useCallback(
    async (intents: CategoryIntentRequest[], chosenPreset: PresetKey) => {
      setError(null);
      try {
        const data = await proposals.mutateAsync({
          income,
          fixed_total: fixed,
          savings_target: savings,
          currency,
          period: "monthly",
          cycle_start_day: cycleStartDay,
          profile_preset: chosenPreset,
          intents,
        });
        const restored = restoreProposal(data, {
          pendingSavedRows,
          restoredFrom,
          keptPlan: keptCategories.keptPlan,
          chosenPreset,
          categoryIds: prefill.data ? new Set(prefill.data.categories.map((c) => c.id)) : null,
        });
        setResult(restored.response);
        if (restored.addedIds) setAddedIds(restored.addedIds);
        if (restored.pendingCategories) setPendingCategories(restored.pendingCategories);
        if (restored.renamedCategories) renames.resetRenames(restored.renamedCategories);
        if (restored.removedIds) setRemovedIds(restored.removedIds);
        // One-shot: from here on the screen is live, and a retry after changing
        // the income must show what the server actually says.
        setPendingSavedRows(null);
      } catch (e) {
        setResult(null);
        setError(errorText(e, "budgetWizard.error.proposalFailed"));
      }
    },
    // prefill.data, renames: read when a saved plan is restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proposals, income, fixed, savings, currency, cycleStartDay, pendingSavedRows, restoredFrom, keptCategories.keptPlan, prefill.data],
  );

  const selectPreset = useCallback(
    (key: PresetKey) => {
      setPreset(key);
      setStep(3);
      const { intents, problem } = intentsForPreset(key);
      if (problem) {
        setResult(null);
        setError(PROBLEM_MESSAGES[problem]);
        return;
      }
      void requestProposal(intents, key);
    },
    [intentsForPreset, requestProposal],
  );

  const retryProposal = useCallback(() => {
    if (!preset) return;
    const { intents, problem } = intentsForPreset(preset);
    if (problem) {
      setResult(null);
      setError(PROBLEM_MESSAGES[problem]);
      return;
    }
    void requestProposal(intents, preset);
  }, [preset, intentsForPreset, requestProposal]);

  const rowEdits = useWizardRowEdits({ setResult, setAddedIds, setRemovedIds, setPendingCategories, setAddRowOpen });

  /**
   * Whether this account already has budgets that a run would replace.
   *
   * Read from the prefill response the wizard already fetched rather than from a
   * second budgets query — it is on the wire either way, and two sources for one
   * fact can disagree.
   */
  const stepBack = useWizardStepBack({
    resultStep: BUDGET_WIZARD_TOTAL_STEPS,
    step,
    hasResult: result !== null,
    setStep,
    remember: () => {
      if (result) keptCategories.remember(result.proposals, addedIds, pendingCategories, removedIds);
    },
    forget: keptCategories.forget,
    onDiscard: () => setRemovedIds([]),
  });

  const hasExistingBudgets = (prefill.data?.existing_budgets?.length ?? 0) > 0;

  // Everything the saved plan keeps. It also says whether what is on screen
  // is what was kept (planSaved), so the save button follows every edit.
  const persistence = useWizardPlanPersistence({
    result,
    currency,
    income,
    fixed,
    fixedCostsText: fixedCosts.text,
    fixedCostsSuggested: fixedCosts.suggested,
    savingsChoice,
    cycleStartDay,
    preset,
    addedIds,
    pendingCategories,
    renamedCategories: renames.renamedCategories,
  });

  /** Drops the restored figures and starts this run from zero. The plan stays kept. */
  const discardSavedPlan = useCallback(() => startFrom(null), [startFrom]);

  const submit = useCallback(async () => {
    setError(null);
    const outcome = await commit.submit({
      result,
      currency,
      pendingCategories,
      renamedCategories: renames.renamedCategories,
    });
    if ("error" in outcome) {
      if (outcome.error) setError(outcome.error);
      return;
    }
    setStep(BUDGET_WIZARD_TOTAL_STEPS + 1);
    onCompleted?.(outcome.count);
  }, [commit, result, currency, pendingCategories, renames.renamedCategories, onCompleted]);

  const canLeaveIncomeStep = useMemo(
    () => validateIncomeStep(income, fixed, savings).ok,
    [income, fixed, savings],
  );

  return {
    step,
    currency,
    income,
    fixed,
    savings,
    savingsChoice,
    cycleStartDay,
    fixedCostsText: fixedCosts.text,
    fixedCostsSuggested: fixedCosts.suggested,
    fixedCostItems: fixedCosts.items,
    fixedCostsOpen: fixedCosts.open,
    fixedCostsRescaled: fixedCosts.rescaled,
    disposable,
    hasExistingBudgets,
    // Present only when this run was seeded from a kept plan — screen 1's
    // banner and nothing else reads it.
    restoredFrom,
    savedPlan,
    planSaved: persistence.planSaved,
    overwriteConfirmOpen,
    preset,
    result,
    addedIds,
    addRowOpen,
    availableCategories: prefill.data?.categories ?? [],
    rowNameKind: renames.nameKind,
    renameRow: renames.renameRow,
    createdCount: commit.createdCount,
    error,
    loadingProposal: proposals.isPending,
    submitting: commit.submitting,
    setIncome,
    setFixed: fixedCosts.setFixed,
    setSavingsChoice,
    setCycleStartDay,
    openFixedCosts: fixedCosts.openHelper,
    closeFixedCosts: fixedCosts.closeHelper,
    applyFixedCosts: fixedCosts.apply,
    goToProfile: () => canLeaveIncomeStep && setStep(2),
    // ⚠️ Never below 1, and never back FROM the success screen: a plan has been
    // written by then, so "back" would offer to re-run a decision that is
    // already committed.
    goBack: () => setStep((prev) => Math.max(1, Math.min(prev, BUDGET_WIZARD_TOTAL_STEPS) - 1)),
    // From the result step, going back asks first — the user is about to
    // change an input every figure on screen was derived from.
    backConfirmOpen: stepBack.backConfirmOpen,
    requestBack: stepBack.requestBack,
    confirmBackKeeping: stepBack.confirmBackKeeping,
    confirmBackDiscarding: stepBack.confirmBackDiscarding,
    cancelBack: stepBack.closeBackConfirm,
    canSubmit: (result?.proposals.length ?? 0) >= MIN_PLAN_ROWS,
    selectPreset,
    retryProposal,
    editAmount: rowEdits.editAmount,
    openAddRow: () => setAddRowOpen(true),
    closeAddRow: () => setAddRowOpen(false),
    addProposalRow: rowEdits.addProposalRow,
    removeProposalRow: rowEdits.removeProposalRow,
    // ⚠️ The submit button calls THIS, not submit(): POST /budgets/bulk replaces
    // the caller's entire active budget set (see useBulkCreateBudgetsMutation),
    // so running the wizard on an account that already has budgets silently
    // discards every one of them. That is a fine outcome when it is what the
    // user meant and a terrible one when it is not, and nothing on screen 3 said
    // which was about to happen.
    requestSubmit: () => {
      // ⚠️ Checked before the overwrite prompt, not after: an empty plan is
      // refused outright rather than offered as something to confirm.
      if ((result?.proposals.length ?? 0) < MIN_PLAN_ROWS) {
        setError(i18n.t("budgetWizard.error.emptyPlan"));
        return;
      }
      if (hasExistingBudgets) setOverwriteConfirmOpen(true);
      else void submit();
    },
    confirmOverwrite: () => {
      setOverwriteConfirmOpen(false);
      void submit();
    },
    cancelOverwrite: () => setOverwriteConfirmOpen(false),
    submit,
    savePlan: persistence.savePlan,
    discardSavedPlan,
    /** Starts this run over from another kept plan (the saved-plans list). */
    applySavedPlan: startFrom,
    close: onClose,
  };
}
