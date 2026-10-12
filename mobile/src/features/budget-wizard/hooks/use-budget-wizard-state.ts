import { useCallback, useEffect, useMemo, useState } from "react";

import { useBudgetProposalsMutation } from "@/features/budget-wizard/api/use-budget-proposals-mutation";
import { useBudgetWizardPrefillQuery } from "@/features/budget-wizard/api/use-budget-wizard-prefill-query";
import { AddBudgetRowResult } from "@/features/budget-wizard/components/AddBudgetRowModal";
import {
  DEFAULT_SAVINGS_CHOICE,
  SavingsChoice,
  disposableXu,
  savingsAmount,
  validateIncomeStep,
} from "@/features/budget-wizard/budget-math";
import { useWizardFixedCosts } from "@/features/budget-wizard/hooks/use-wizard-fixed-costs";
import { SavedBudgetPlan, SavedPlanRow, useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { useWizardPlanPersistence } from "@/features/budget-wizard/hooks/use-wizard-plan-persistence";
import { useWizardSubmit } from "@/features/budget-wizard/hooks/use-wizard-submit";
import { withAddedRow, withEditedAmount, withRemovedRow } from "@/features/budget-wizard/proposal-edits";
import { PROBLEM_MESSAGES, resolvePresetIntents } from "@/features/budget-wizard/preset-intents";
import { useWizardKeptCategories } from "@/features/budget-wizard/hooks/use-wizard-kept-categories";
import { useWizardStepBack } from "@/features/budget-wizard/hooks/use-wizard-step-back";
import { restoreProposal } from "@/features/budget-wizard/proposal-restore";
import { BudgetProposalsResponse, CategoryIntentRequest, PresetKey } from "@/features/budget-wizard/types";
import { getErrorMessage } from "@/lib/api-envelope";

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
  const [error, setError] = useState<string | null>(null);
  // Set when this run was seeded from a saved plan: the banner on screen 1
  // reads it, and the amounts are re-applied once the server's proposal for the
  // saved preset comes back (see applySavedRows).
  const [restoredFrom, setRestoredFrom] = useState<SavedBudgetPlan | null>(null);
  const [pendingSavedRows, setPendingSavedRows] = useState<SavedPlanRow[] | null>(null);
  const [planSaved, setPlanSaved] = useState(false);
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
  useEffect(() => {
    if (!visible || !savedPlanHydrated) return;
    const plan = useSavedBudgetPlanStore.getState().plan;
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
    commit.resetCreatedCount();
    setError(null);
    setRestoredFrom(plan ?? null);
    setPendingSavedRows(plan?.rows ?? null);
    setPlanSaved(false);
    setOverwriteConfirmOpen(false);
    setRemovedIds([]);
    keptCategories.forget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, savedPlanHydrated]);

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
        });
        setResult(restored.response);
        if (restored.addedIds) setAddedIds(restored.addedIds);
        if (restored.pendingCategories) setPendingCategories(restored.pendingCategories);
        // One-shot: from here on the screen is live, and a retry after changing
        // the income must show what the server actually says.
        setPendingSavedRows(null);
      } catch (e) {
        setResult(null);
        setError(getErrorMessage(e, "Chưa tính được ngân sách. Thử lại."));
      }
    },
    [proposals, income, fixed, savings, currency, cycleStartDay, pendingSavedRows, restoredFrom, keptCategories.keptPlan],
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
  }, []);

  const addProposalRow = useCallback((entry: AddBudgetRowResult) => {
    const tempId = entry.categoryId ?? `new:${Date.now()}`;
    if (!entry.categoryId) setPendingCategories((prev) => ({ ...prev, [tempId]: entry.name }));
    setResult((prev) => (prev ? withAddedRow(prev, tempId, entry.name, entry.amountXu) : prev));
    setAddedIds((prev) => (prev.includes(tempId) ? prev : [...prev, tempId]));
    setAddRowOpen(false);
  }, []);

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
  }, []);

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

  const persistence = useWizardPlanPersistence(useCallback(() => setPlanSaved(true), []));

  const savePlan = useCallback(
    () =>
      persistence.savePlan({
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
      }),
    [
      persistence,
      result,
      currency,
      income,
      fixed,
      fixedCosts.text,
      fixedCosts.suggested,
      savingsChoice,
      cycleStartDay,
      preset,
      addedIds,
      pendingCategories,
    ],
  );

  /** Drops the restored figures and starts this run from zero. */
  const discardSavedPlan = useCallback(() => {
    persistence.clearStoredPlan();
    setRestoredFrom(null);
    setPendingSavedRows(null);
    setIncome(0);
    fixedCosts.reset();
    setPreset(null);
    setResult(null);
    setAddedIds([]);
    setPendingCategories({});
  }, [persistence, fixedCosts]);

  const submit = useCallback(async () => {
    setError(null);
    const outcome = await commit.submit({ result, currency, pendingCategories });
    if ("error" in outcome) {
      if (outcome.error) setError(outcome.error);
      return;
    }
    setStep(BUDGET_WIZARD_TOTAL_STEPS + 1);
    onCompleted?.(outcome.count);
  }, [commit, result, currency, pendingCategories, onCompleted]);

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
    fixedCostsOpen: fixedCosts.open,
    fixedCostsRescaled: fixedCosts.rescaled,
    disposable,
    hasExistingBudgets,
    // Present only when this run was seeded from a kept plan — screen 1's
    // banner and nothing else reads it.
    restoredFrom,
    savedPlan,
    planSaved,
    overwriteConfirmOpen,
    preset,
    result,
    addedIds,
    addRowOpen,
    availableCategories: prefill.data?.categories ?? [],
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
    editAmount,
    openAddRow: () => setAddRowOpen(true),
    closeAddRow: () => setAddRowOpen(false),
    addProposalRow,
    removeProposalRow,
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
        setError("Kế hoạch đang trống. Thêm ít nhất một danh mục trước khi lưu.");
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
    savePlan,
    discardSavedPlan,
    close: onClose,
  };
}
