import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AmountPromptModal } from "@/components/ui/AmountPromptModal";
import { FixedCostsModal } from "@/features/budget-wizard/components/FixedCostsModal";
import { MoneyField } from "@/features/budget-wizard/components/MoneyField";
import {
  DEFAULT_SAVINGS_PCT,
  SAVINGS_PCT_OPTIONS,
  SavingsChoice,
  daysInCycle,
  disposableXu,
  perDayXu,
  roundStepXu,
  savingsAmount,
  validateIncomeStep,
} from "@/features/budget-wizard/budget-math";
import {
  FixedCostItem,
  mergeFixedCosts,
  parseFixedCosts,
  summarizeFixedCosts,
  totalFixedCosts,
} from "@/features/budget-wizard/fixed-costs";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface WizardStepIncomeProps {
  currency: string;
  /** xu. */
  income: number;
  fixed: number;
  savingsChoice: SavingsChoice;
  cycleStartDay: number;
  /** Whatever the fixed-cost helper produced last time, so it resumes on reopen. */
  fixedCostsText: string;
  fixedCostsSuggested: FixedCostItem[];
  onChangeIncome: (v: number) => void;
  onChangeFixed: (v: number) => void;
  onChangeSavingsChoice: (c: SavingsChoice) => void;
  onChangeCycleStartDay: (v: number) => void;
  onChangeFixedCosts: (result: { items: FixedCostItem[]; text: string; suggested: FixedCostItem[] }) => void;
  onNext: () => void;
}

/** The slider's convenience span: 0–50tr đồng. Typing goes past it freely. */
const INCOME_SLIDER_CEILING_XU = 50_000_000_00;
const FIXED_SLIDER_CEILING_XU = 20_000_000_00;

const CYCLE_DAY_CHOICES = [1, 5, 10, 15, 20, 25, 28];

/**
 * Screen 1 — what comes in, what is already committed, what to set aside.
 *
 * The order is the argument: income, then the money that is already spoken for,
 * then savings — and only what survives all three is what the rest of the wizard
 * divides up. Budgeting from gross income is how a plan ends up describing money
 * that was never available.
 *
 * ⚠️ The "Còn được chi" and "đ/ngày" figures update on every keystroke, and that
 * is the point rather than a flourish: a user who abandons the wizard right here
 * has still learned the single most useful number in it. The screen has to be
 * worth finishing on its own before step 2 asks for anything else.
 */
export function WizardStepIncome({
  currency,
  income,
  fixed,
  savingsChoice,
  cycleStartDay,
  fixedCostsText,
  fixedCostsSuggested,
  onChangeIncome,
  onChangeFixed,
  onChangeSavingsChoice,
  onChangeCycleStartDay,
  onChangeFixedCosts,
  onNext,
}: WizardStepIncomeProps) {
  const [savingsPromptOpen, setSavingsPromptOpen] = useState(false);
  const [fixedCostsOpen, setFixedCostsOpen] = useState(false);

  const savings = savingsAmount(savingsChoice, income);
  const disposable = disposableXu(income, fixed, savings);
  const days = daysInCycle(cycleStartDay);
  const perDay = perDayXu(disposable, days);
  const validation = validateIncomeStep(income, fixed, savings);

  // Recomputed from the two things the parent stores rather than kept as a
  // third: the merge is deterministic, so deriving it here cannot drift out of
  // step with what the helper itself would show.
  const breakdown = useMemo(
    () => mergeFixedCosts(parseFixedCosts(fixedCostsText), fixedCostsSuggested),
    [fixedCostsText, fixedCostsSuggested],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Mỗi tháng bạn có bao nhiêu?</Text>

        <MoneyField
          testID="input-wizard-income"
          label="Thu nhập hàng tháng"
          value={income}
          onChange={onChangeIncome}
          sliderCeiling={INCOME_SLIDER_CEILING_XU}
        />

        <MoneyField
          testID="input-wizard-fixed"
          label="Chi phí cố định"
          // Once the helper has run, the hint shows what the total is actually
          // made of instead of describing the category in the abstract — the
          // fastest way to spot that a cost is missing.
          hint={breakdown.length > 0 ? summarizeFixedCosts(breakdown) : "nhà, điện nước, internet, học phí"}
          value={fixed}
          onChange={onChangeFixed}
          sliderCeiling={FIXED_SLIDER_CEILING_XU}
          // Sits on the hint row because it answers the hint: the hint lists
          // what counts as fixed, and this is for the user who reads that list
          // and realises they do not know the total.
          action={{
            label: breakdown.length > 0 ? `${breakdown.length} khoản ✎` : "Tôi không nhớ tổng →",
            onPress: () => setFixedCostsOpen(true),
            testID: "btn-wizard-fixed-costs",
          }}
        />

        <View style={styles.field}>
          <View style={styles.savingsHeader}>
            <Text style={styles.label}>Muốn để dành</Text>
            <Text style={styles.savingsAmount}>{formatCurrency(savings, currency)}</Text>
          </View>
          <View style={styles.chipRow}>
            {SAVINGS_PCT_OPTIONS.map((pct) => {
              const active = savingsChoice.kind === "pct" && pct === savingsChoice.pct;
              return (
                <Pressable
                  key={pct}
                  testID={`chip-wizard-savings-${pct}`}
                  onPress={() => onChangeSavingsChoice({ kind: "pct", pct })}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {pct === 0 ? "Chưa" : `${pct}%`}
                  </Text>
                </Pressable>
              );
            })}
            {/* Last in the row: a flat figure for people saving toward a fixed
                commitment — a 3tr transfer, a loan repayment — which a
                percentage cannot express without re-deriving it by hand every
                time income changes. */}
            <Pressable
              testID="chip-wizard-savings-custom"
              onPress={() => setSavingsPromptOpen(true)}
              style={[styles.chip, savingsChoice.kind === "amount" && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, savingsChoice.kind === "amount" && styles.chipLabelActive]}>
                {savingsChoice.kind === "amount" ? "Số khác ✎" : "Số khác"}
              </Text>
            </Pressable>
          </View>
          {/* 10% is the default rather than the textbook 20%. Someone who has
              never tracked their spending, committing a fifth of their income on
              top of costs they have not measured, breaks the plan in week two —
              and an abandoned plan saves nothing at all. */}
          {savingsChoice.kind === "pct" && savingsChoice.pct === DEFAULT_SAVINGS_PCT ? (
            <Text style={styles.hint}>Mức dễ giữ được. Tháng sau dư thì mình nâng lên.</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Lương về ngày</Text>
          <View style={styles.chipRow}>
            {CYCLE_DAY_CHOICES.map((day) => {
              const active = day === cycleStartDay;
              return (
                <Pressable
                  key={day}
                  testID={`picker-wizard-cycle-day-${day}`}
                  onPress={() => onChangeCycleStartDay(day)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Chu kỳ này dài {days} ngày.</Text>
        </View>

        <View style={styles.result}>
          <View style={styles.resultLeft}>
            <Text style={styles.label}>Còn được chi</Text>
            <Text testID="text-wizard-disposable" style={styles.resultBig}>
              {/* An em dash, not 0đ. Zero is a computed answer; this is "not
                  answerable yet", and showing 0đ would state something false. */}
              {disposable > 0 ? formatCurrency(disposable, currency) : "—"}
            </Text>
          </View>
          <Text testID="text-wizard-per-day" style={styles.resultPerDay}>
            {perDay > 0 ? `${formatCurrency(perDay, currency)}\nmỗi ngày` : ""}
          </Text>
        </View>

        {!validation.ok ? <Text style={styles.error}>{validation.message}</Text> : null}
      </ScrollView>

      <Pressable
        testID="btn-wizard-next-income"
        onPress={onNext}
        disabled={!validation.ok}
        style={[styles.primaryBtn, !validation.ok && styles.primaryBtnDisabled]}
      >
        <Text style={styles.primaryLabel}>Tiếp →</Text>
      </Pressable>

      <AmountPromptModal
        visible={savingsPromptOpen}
        title="Muốn để dành bao nhiêu?"
        hint="Không quá thu nhập"
        value={savings}
        max={income}
        step={roundStepXu(Math.max(income, 1))}
        currency={currency}
        testID="btn-wizard-savings-custom-confirm"
        onClose={() => setSavingsPromptOpen(false)}
        onConfirm={(amountXu) => {
          onChangeSavingsChoice({ kind: "amount", amountXu });
          setSavingsPromptOpen(false);
        }}
      />

      <FixedCostsModal
        visible={fixedCostsOpen}
        currency={currency}
        initialText={fixedCostsText}
        initialSuggested={fixedCostsSuggested}
        onClose={() => setFixedCostsOpen(false)}
        onConfirm={(result) => {
          onChangeFixedCosts(result);
          onChangeFixed(totalFixedCosts(result.items));
          setFixedCostsOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
  savingsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  savingsAmount: { ...typography.label, color: colors.textPrimary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { borderColor: colors.green, backgroundColor: "rgba(133,255,51,0.08)" },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.green },
  result: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.md,
  },
  resultLeft: { gap: 2 },
  resultBig: { ...typography.hero, fontSize: 26, color: colors.textPrimary },
  resultPerDay: { ...typography.label, color: colors.green, textAlign: "right" },
  error: { ...typography.caption, color: colors.mustard },
  primaryBtn: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.green,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryLabel: { ...typography.body, color: colors.onGreen },
});
