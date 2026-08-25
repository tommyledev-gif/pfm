import { useEffect, useMemo, useRef, useState } from "react";

import { useBudgetProposalsMutation } from "@/features/budget-wizard/api/use-budget-proposals-mutation";
import { useBudgetWizardPrefillQuery } from "@/features/budget-wizard/api/use-budget-wizard-prefill-query";
import { useSubmitBudgetWizard } from "@/features/budget-wizard/api/use-submit-budget-wizard";
import {
  BudgetWizardPeriod,
  BulkBudgetItem,
  PendingCustomCategory,
  SpendingPreference,
  WizardSelection,
} from "@/features/budget-wizard/types";
import { WalletCurrency } from "@/lib/constants";

export const BUDGET_WIZARD_TOTAL_STEPS = 4;

// All of BudgetWizardModal's state, derived values, and step-transition
// handlers — split into its own hook purely to keep BudgetWizardModal.tsx
// (the layout/JSX half) under the project's 300-line cap.
export function useBudgetWizardState(visible: boolean, onClose: () => void, onCompleted?: (createdCount: number) => void) {
  const [step, setStep] = useState(1);
  const [incomeSubmitAttempted, setIncomeSubmitAttempted] = useState(false);
  const [categoriesSubmitAttempted, setCategoriesSubmitAttempted] = useState(false);
  const [period, setPeriod] = useState<BudgetWizardPeriod>("monthly");
  const [income, setIncome] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customCategories, setCustomCategories] = useState<PendingCustomCategory[]>([]);
  const [preferences, setPreferences] = useState<Record<string, SpendingPreference>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [reasoningByCategoryId, setReasoningByCategoryId] = useState<Record<string, string>>({});
  // Entries POST /ai/budget-proposals returns for a Category the user never
  // selected in step 2 (currently just the backend's own default-injected
  // Savings proposal, backend/internal/service/budget_wizard_service.go's
  // defaultSavingsEntry) — `selections` itself is only ever derived from
  // selectedIds/customCategories, so without tracking these separately
  // step 4 would silently drop that entry's amount/reasoning on the floor.
  const [extraProposalEntries, setExtraProposalEntries] = useState<WizardSelection[]>([]);
  const [scaledDownNotice, setScaledDownNotice] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const prefilledRef = useRef(false);

  const prefill = useBudgetWizardPrefillQuery(visible);
  const proposalsMutation = useBudgetProposalsMutation();
  const { submit, isSubmitting, error: submitError } = useSubmitBudgetWizard();

  const currency: WalletCurrency = prefill.data?.currency ?? "VND";
  // spec.md US-03 Main Flow step 2 (resolved Open Questions #5, 2026-08-24):
  // the picker offers expense-type Categories only.
  const categories = useMemo(
    () => (prefill.data?.categories ?? []).filter((c) => c.type === "expense"),
    [prefill.data],
  );
  // A Budget on a non-expense Category (possible via F-05's own type-agnostic
  // create flow, before this filter existed) never appears in `selections`
  // below, so it must be re-submitted unchanged here — otherwise US-05's
  // full-replace bulk-create would silently soft-delete it just because this
  // wizard run never offered it for review.
  const preservedBudgets: BulkBudgetItem[] = useMemo(() => {
    if (!prefill.data) return [];
    const expenseIds = new Set(categories.map((c) => c.id));
    return prefill.data.existing_budgets
      .filter((b) => !expenseIds.has(b.category_id))
      .map((b) => ({
        category_id: b.category_id,
        period: b.period as BudgetWizardPeriod,
        limits: b.limits.map((l) => ({ currency: l.currency, amount_limit: l.amount_limit })),
      }));
  }, [prefill.data, categories]);

  useEffect(() => {
    if (!visible) {
      prefilledRef.current = false;
      setStep(1);
      setIncomeSubmitAttempted(false);
      setCategoriesSubmitAttempted(false);
      setPeriod("monthly");
      setIncome("");
      setSelectedIds(new Set());
      setCustomCategories([]);
      setPreferences({});
      setAmounts({});
      setReasoningByCategoryId({});
      setExtraProposalEntries([]);
      setScaledDownNotice(false);
      setCreatedCount(null);
    }
  }, [visible]);

  // US-01 Main Flow step 4: pre-select every Category with an existing
  // active Budget, only once per wizard run (not re-applied over the user's
  // own toggles once they start editing).
  useEffect(() => {
    if (!visible || prefilledRef.current || !prefill.data) return;
    prefilledRef.current = true;
    setSelectedIds(new Set(prefill.data.existing_budgets.map((b) => b.category_id)));
  }, [visible, prefill.data]);

  const selections: WizardSelection[] = useMemo(() => {
    const real = categories
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ categoryId: c.id, categoryName: c.name, isPending: false, preference: preferences[c.id] ?? "normal" }));
    const pending = customCategories.map((c) => ({
      categoryId: c.clientId,
      categoryName: c.name,
      isPending: true,
      preference: preferences[c.clientId] ?? "normal",
    }));
    return [...real, ...pending];
  }, [categories, selectedIds, customCategories, preferences]);

  // What step 4 actually renders/submits — `selections` plus any backend-
  // injected entry (see extraProposalEntries above) the user hasn't removed.
  const proposalSelections: WizardSelection[] = useMemo(
    () => [...selections, ...extraProposalEntries],
    [selections, extraProposalEntries],
  );

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size + customCategories.length < 20) next.add(id);
      return next;
    });
  };

  const addCustomCategory = (category: PendingCustomCategory) => {
    setCustomCategories((prev) => (prev.length + selectedIds.size < 20 ? [...prev, category] : prev));
  };

  const removeCustomCategory = (clientId: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.clientId !== clientId));
  };

  const goToStep3 = () => {
    setCategoriesSubmitAttempted(true);
    if (selectedIds.size + customCategories.length === 0) return;
    setPreferences((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) if (!next[id]) next[id] = "normal";
      for (const c of customCategories) if (!next[c.clientId]) next[c.clientId] = "normal";
      return next;
    });
    setStep(3);
  };

  const goToStep4 = () => {
    const incomeCents = Math.round(Number(income) * 100);
    const realPreferences = selections
      .filter((s) => !s.isPending)
      .map((s) => ({ category_id: s.categoryId, category_name: s.categoryName, spending_preference: s.preference }));

    if (realPreferences.length === 0) {
      // Every selected Category is a still-pending custom one — nothing to
      // send to POST /ai/budget-proposals (min=1 preferences). Split income
      // evenly across the pending set instead (Open Questions #2).
      const share = customCategories.length > 0 ? Math.floor(incomeCents / customCategories.length) : 0;
      const evenAmounts: Record<string, number> = {};
      for (const c of customCategories) evenAmounts[c.clientId] = share;
      setAmounts(evenAmounts);
      setReasoningByCategoryId({});
      setExtraProposalEntries([]);
      setScaledDownNotice(false);
      setStep(4);
      return;
    }

    proposalsMutation.mutate(
      { income: incomeCents, currency, period, preferences: realPreferences },
      {
        onSuccess: (data) => {
          const newAmounts: Record<string, number> = {};
          const newReasoning: Record<string, string> = {};
          const selectedCategoryIds = new Set(realPreferences.map((p) => p.category_id));
          const extras: WizardSelection[] = [];
          for (const p of data.proposals) {
            newAmounts[p.category_id] = p.proposed_amount;
            newReasoning[p.category_id] = p.reasoning;
            // A proposal for a Category not in what step 2/3 selected — the
            // backend's own default-injected Savings entry (see
            // defaultSavingsEntry server-side) — needs to be tracked
            // separately so step 4 actually renders/submits it too.
            if (!selectedCategoryIds.has(p.category_id)) {
              extras.push({ categoryId: p.category_id, categoryName: p.category_name, isPending: false, preference: "normal" });
            }
          }
          if (customCategories.length > 0) {
            const share = Math.max(0, Math.floor(data.unallocated_amount / customCategories.length));
            for (const c of customCategories) newAmounts[c.clientId] = share;
          }
          setAmounts(newAmounts);
          setReasoningByCategoryId(newReasoning);
          setExtraProposalEntries(extras);
          setScaledDownNotice(data.scaled_down_notice);
          setStep(4);
        },
      },
    );
  };

  // Step 4 (spec.md US-04/US-05 revision) lets the user drop a proposed
  // budget entirely before confirming — a real selection goes back through
  // toggleCategory/removeCustomCategory so it stays excluded if the user
  // steps back to re-review step 2/3; a backend-injected extra (Savings) is
  // never in selectedIds/customCategories to begin with, so it's just
  // dropped from extraProposalEntries directly.
  const removeProposalEntry = (categoryId: string) => {
    if (extraProposalEntries.some((e) => e.categoryId === categoryId)) {
      setExtraProposalEntries((prev) => prev.filter((e) => e.categoryId !== categoryId));
      return;
    }
    if (customCategories.some((c) => c.clientId === categoryId)) {
      removeCustomCategory(categoryId);
      return;
    }
    toggleCategory(categoryId);
  };

  const handleConfirm = async () => {
    try {
      const count = await submit(proposalSelections, amounts, period, currency, customCategories, preservedBudgets);
      setCreatedCount(count);
      setStep(5);
    } catch {
      // submitError below already surfaces the failure inline on step 4.
    }
  };

  const handleDone = () => {
    if (createdCount !== null) onCompleted?.(createdCount);
    onClose();
  };

  const incomeCents = Math.round(Number(income) * 100);

  return {
    step,
    setStep,
    incomeSubmitAttempted,
    categoriesSubmitAttempted,
    period,
    setPeriod,
    income,
    setIncome,
    incomeCents,
    currency,
    selectedIds,
    customCategories,
    preferences,
    setPreferences,
    amounts,
    setAmounts,
    reasoningByCategoryId,
    scaledDownNotice,
    createdCount,
    categories,
    selections,
    proposalSelections,
    removeProposalEntry,
    toggleCategory,
    addCustomCategory,
    removeCustomCategory,
    onSubmitIncome: () => {
      setIncomeSubmitAttempted(true);
      const value = Number(income);
      if (!income || !(value > 0) || Math.round(value * 100) > 9_999_999_999) return;
      setStep(2);
    },
    goToStep3,
    goToStep4,
    handleConfirm,
    handleDone,
    proposalsMutation,
    isSubmitting,
    submitError,
  };
}
