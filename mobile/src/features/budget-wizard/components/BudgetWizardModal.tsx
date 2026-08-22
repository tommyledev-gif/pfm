import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { CheckIcon } from "@/components/ui/Icon";
import { colors, spacing, typography } from "@/lib/theme";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetProposalsMutation } from "@/features/budget-wizard/api/use-budget-proposals-mutation";
import { useBudgetWizardPrefillQuery } from "@/features/budget-wizard/api/use-budget-wizard-prefill-query";
import { useSubmitBudgetWizard } from "@/features/budget-wizard/api/use-submit-budget-wizard";
import { WizardStepCategories } from "@/features/budget-wizard/components/WizardStepCategories";
import { WizardStepIncomePeriod } from "@/features/budget-wizard/components/WizardStepIncomePeriod";
import { WizardStepPreferences } from "@/features/budget-wizard/components/WizardStepPreferences";
import { WizardStepProposal } from "@/features/budget-wizard/components/WizardStepProposal";
import {
  BudgetWizardPeriod,
  PendingCustomCategory,
  SpendingPreference,
  WizardSelection,
} from "@/features/budget-wizard/types";

const TOTAL_STEPS = 4;

interface BudgetWizardModalProps {
  visible: boolean;
  onClose: () => void;
  // Lets the caller (e.g. a budget_wizard chat card) react to a completed
  // run — spec.md US-05 Main Flow step 6.
  onCompleted?: (createdCount: number) => void;
}

// Full-screen guided flow (SDS.md §3.2 "multi-step guided flows") — a
// visible progress indicator across 4 steps, dismissing at any point
// discards all in-progress state (spec.md feature-level Precondition:
// nothing is written before the final confirm).
export function BudgetWizardModal({ visible, onClose, onCompleted }: BudgetWizardModalProps) {
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
  const [scaledDownNotice, setScaledDownNotice] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const prefilledRef = useRef(false);

  const prefill = useBudgetWizardPrefillQuery(visible);
  const proposalsMutation = useBudgetProposalsMutation();
  const { submit, isSubmitting, error: submitError } = useSubmitBudgetWizard();

  const currency: WalletCurrency = prefill.data?.currency ?? "VND";
  const categories = useMemo(() => prefill.data?.categories ?? [], [prefill.data]);

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
          for (const p of data.proposals) {
            newAmounts[p.category_id] = p.proposed_amount;
            newReasoning[p.category_id] = p.reasoning;
          }
          if (customCategories.length > 0) {
            const share = Math.max(0, Math.floor(data.unallocated_amount / customCategories.length));
            for (const c of customCategories) newAmounts[c.clientId] = share;
          }
          setAmounts(newAmounts);
          setReasoningByCategoryId(newReasoning);
          setScaledDownNotice(data.scaled_down_notice);
          setStep(4);
        },
      },
    );
  };

  const handleConfirm = async () => {
    try {
      const count = await submit(selections, amounts, period, currency, customCategories);
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

  return (
    <Drawer visible={visible} onClose={onClose}>
      {step <= TOTAL_STEPS ? (
        <View style={styles.header}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
          </View>
          <Pressable onPress={onClose} hitSlop={12} testID="btn-wizard-dismiss">
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 1 ? (
        <WizardStepIncomePeriod
          period={period}
          onChangePeriod={setPeriod}
          income={income}
          onChangeIncome={setIncome}
          currency={currency}
          submitAttempted={incomeSubmitAttempted}
          onDismiss={onClose}
          onNext={() => {
            setIncomeSubmitAttempted(true);
            const value = Number(income);
            if (!income || !(value > 0) || Math.round(value * 100) > 9_999_999_999) return;
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <WizardStepCategories
          categories={categories}
          selectedIds={selectedIds}
          onToggleCategory={toggleCategory}
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
          onRemoveCustomCategory={removeCustomCategory}
          submitAttempted={categoriesSubmitAttempted}
          onNext={goToStep3}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 ? (
        <WizardStepPreferences
          selections={selections}
          onChangePreference={(id, pref) => setPreferences((prev) => ({ ...prev, [id]: pref }))}
          onNext={goToStep4}
          onBack={() => setStep(2)}
        />
      ) : null}

      {step === 4 ? (
        <WizardStepProposal
          selections={selections}
          amounts={amounts}
          onChangeAmount={(id, cents) => setAmounts((prev) => ({ ...prev, [id]: cents }))}
          reasoningByCategoryId={reasoningByCategoryId}
          income={Math.round(Number(income) * 100)}
          currency={currency}
          isLoading={proposalsMutation.isPending}
          loadError={proposalsMutation.error}
          scaledDownNotice={scaledDownNotice}
          onConfirm={handleConfirm}
          confirming={isSubmitting}
          confirmError={submitError}
          onBack={() => setStep(3)}
        />
      ) : null}

      {step === 5 ? (
        <View style={styles.successContainer}>
          <CheckIcon size={40} color={colors.green} />
          <Text style={styles.successTitle}>Đã tạo {createdCount ?? 0} ngân sách</Text>
          <PillButton label="Xong" onPress={handleDone} style={styles.doneButton} />
        </View>
      ) : null}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.green, borderRadius: 2 },
  closeLabel: { ...typography.body, color: colors.textSecondary },
  successContainer: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  successTitle: { ...typography.title, color: colors.textPrimary },
  doneButton: { alignSelf: "stretch", marginTop: spacing.md },
});
