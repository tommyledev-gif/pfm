import { useCallback, useEffect, useMemo, useState } from "react";

import { useBudgetProposalsMutation } from "@/features/budget-wizard/api/use-budget-proposals-mutation";
import { useBudgetWizardPrefillQuery } from "@/features/budget-wizard/api/use-budget-wizard-prefill-query";
import { useBulkCreateBudgetsMutation } from "@/features/budget-wizard/api/use-bulk-create-budgets-mutation";
import {
  DEFAULT_SAVINGS_CHOICE,
  SavingsChoice,
  disposableXu,
  savingsAmount,
  validateIncomeStep,
} from "@/features/budget-wizard/budget-math";
import { FixedCostItem } from "@/features/budget-wizard/fixed-costs";
import {
  BudgetProposalsResponse,
  CategoryIntentRequest,
  PresetKey,
  ProposalEntry,
} from "@/features/budget-wizard/types";
import { getErrorMessage } from "@/lib/api-envelope";

export const BUDGET_WIZARD_TOTAL_STEPS = 3;

/** Why the wizard could not build a proposal, when the reason is the server's
 *  state rather than the user's input. Kept separate from ordinary request
 *  failures because the fix is different: these need a deploy, not a retry. */
type WizardProblem = "server_outdated" | "categories_unmigrated";

const PROBLEM_MESSAGES: Record<WizardProblem, string> = {
  server_outdated:
    "Máy chủ chưa hỗ trợ phiên bản thiết lập ngân sách này. Bạn cập nhật lại máy chủ rồi thử lại nhé.",
  categories_unmigrated:
    "Danh mục hệ thống trên máy chủ chưa được cập nhật nên chưa khớp được với các gói gợi ý.",
};

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
  const [fixed, setFixed] = useState(0);
  const [savingsChoice, setSavingsChoice] = useState<SavingsChoice>(DEFAULT_SAVINGS_CHOICE);
  // The fixed-cost helper's own working state, kept here so reopening it resumes
  // where the user left off instead of asking them to describe everything again.
  const [fixedCostsText, setFixedCostsText] = useState("");
  const [fixedCostsSuggested, setFixedCostsSuggested] = useState<FixedCostItem[]>([]);
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [preset, setPreset] = useState<PresetKey | null>(null);

  const [result, setResult] = useState<BudgetProposalsResponse | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prefill = useBudgetWizardPrefillQuery(visible);
  const proposals = useBudgetProposalsMutation();
  const bulkCreate = useBulkCreateBudgetsMutation();

  const currency = prefill.data?.currency ?? "VND";
  const savings = savingsAmount(savingsChoice, income);
  const disposable = disposableXu(income, fixed, savings);

  // Reset on every open. A wizard that reopens holding the previous run's
  // half-finished figures looks like it saved something it did not.
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setIncome(0);
    setFixed(0);
    setSavingsChoice(
      prefill.data?.default_savings_pct !== undefined
        ? { kind: "pct", pct: prefill.data.default_savings_pct }
        : DEFAULT_SAVINGS_CHOICE,
    );
    setFixedCostsText("");
    setFixedCostsSuggested([]);
    setCycleStartDay(prefill.data?.cycle_start_day ?? 1);
    setPreset(null);
    setResult(null);
    setCreatedCount(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * The categories a preset needs, resolved through system_key against what the
   * user actually has.
   *
   * ⚠️ Every field of the prefill response is read defensively, including ones
   * the current server always sends. A client must not crash because a field it
   * expected is absent — and this one did: `prefill.data?.presets.find(...)`
   * guarded `data` but not `presets`, so a server response without that key
   * threw "Cannot read property 'find' of undefined" the moment a preset was
   * tapped. Optional chaining has to cover the whole path, not just its head.
   *
   * Returns a `problem` rather than an empty array when it cannot build the
   * intents, so the caller can say something specific instead of sending a
   * request that is going to be rejected anyway.
   */
  const intentsForPreset = useCallback(
    (key: PresetKey): { intents: CategoryIntentRequest[]; problem: WizardProblem | null } => {
      const presets = prefill.data?.presets;
      // No preset table at all means this app build is talking to a server that
      // predates the v2 wizard. Nothing downstream can work — POST
      // /ai/budget-proposals would reject the new payload too — so say that
      // plainly rather than failing later and more obscurely.
      if (!presets || presets.length === 0) return { intents: [], problem: "server_outdated" };

      const presetDef = presets.find((p) => p.key === key);
      if (!presetDef?.shares?.length) return { intents: [], problem: "server_outdated" };

      const categories = prefill.data?.categories ?? [];
      const intents = presetDef.shares
        .map((share): CategoryIntentRequest | null => {
          const match = categories.find((c) => c.system_key === share.system_key);
          if (!match) return null;
          return {
            category_id: match.id,
            category_name: match.name,
            system_key: share.system_key,
            source: "preset" as const,
            // Zero on purpose: the server owns the allocation. Computing it here
            // too would mean two implementations of the same formula, free to
            // drift apart.
            amount_min: 0,
            amount_max: 0,
            locked: false,
          };
        })
        .filter((v): v is CategoryIntentRequest => v !== null);

      // Categories carry no system_key until migration 019 has run, so every
      // preset line resolves to nothing. Distinct from the case above: the
      // server is new enough to send presets but its database has not been
      // migrated.
      if (intents.length === 0) return { intents, problem: "categories_unmigrated" };
      return { intents, problem: null };
    },
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
        setResult(data);
      } catch (e) {
        setResult(null);
        setError(getErrorMessage(e, "Chưa tính được ngân sách, bạn thử lại nhé."));
      }
    },
    [proposals, income, fixed, savings, currency, cycleStartDay],
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
   * prevent.
   */
  const editAmount = useCallback((categoryId: string, amountXu: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const proposalsNext: ProposalEntry[] = prev.proposals.map((p) =>
        p.category_id === categoryId
          ? { ...p, amount_min: amountXu, amount_max: amountXu, source: "manual", locked: true }
          : p,
      );
      const allocated = proposalsNext.reduce((sum, p) => sum + p.amount_max, 0);
      return { ...prev, proposals: proposalsNext, unallocated_amount: prev.disposable - allocated };
    });
  }, []);

  const submit = useCallback(async () => {
    if (!result) return;
    setError(null);
    try {
      const data = await bulkCreate.mutateAsync({
        budgets: result.proposals.map((p) => ({
          category_id: p.category_id,
          period: "monthly" as const,
          limits: [{ currency, amount_limit: p.amount_max }],
        })),
      });
      setCreatedCount(data.created_count);
      setStep(BUDGET_WIZARD_TOTAL_STEPS + 1);
      onCompleted?.(data.created_count);
    } catch (e) {
      setError(getErrorMessage(e, "Chưa lưu được ngân sách, bạn thử lại nhé."));
    }
  }, [result, bulkCreate, currency, onCompleted]);

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
    fixedCostsText,
    fixedCostsSuggested,
    disposable,
    preset,
    result,
    createdCount,
    error,
    loadingProposal: proposals.isPending,
    submitting: bulkCreate.isPending,
    setIncome,
    setFixed,
    setSavingsChoice,
    setCycleStartDay,
    setFixedCosts: (result: { items: FixedCostItem[]; text: string; suggested: FixedCostItem[] }) => {
      setFixedCostsText(result.text);
      setFixedCostsSuggested(result.suggested);
    },
    goToProfile: () => canLeaveIncomeStep && setStep(2),
    selectPreset,
    retryProposal,
    editAmount,
    submit,
    close: onClose,
  };
}
