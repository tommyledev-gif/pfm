import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MoneyField } from "@/features/budget-wizard/components/MoneyField";
import { WizardSavingsField } from "@/features/budget-wizard/components/WizardSavingsField";
import {
  SavingsChoice,
  daysInCycle,
  disposableXu,
  perDayXu,
  savingsAmount,
  validateIncomeStep,
} from "@/features/budget-wizard/budget-math";
import {
  FixedCostItem,
  mergeFixedCosts,
  parseFixedCosts,
  summarizeFixedCosts,
} from "@/features/budget-wizard/fixed-costs";
import { formatCurrency } from "@/lib/currency";
import { formatSavedAt } from "@/features/budget-wizard/saved-plan";
import { WIZARD_MONEY_MAX_XU, WIZARD_MONEY_SCALE } from "@/features/budget-wizard/wizard-money-scale";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

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
  onOpenFixedCosts: () => void;
  /** ISO timestamp of the kept plan these figures came from, when they did. */
  restoredFromSavedAt?: string;
  onDiscardSavedPlan?: () => void;
  onNext: () => void;
}

// Both fields span 0 → 10 tỷ (the income cap) on the same non-linear track,
// which keeps 0–50tr as fine-grained as it was when 50tr was the slider's end.
const MONEY_SLIDER = { scale: WIZARD_MONEY_SCALE, max: WIZARD_MONEY_MAX_XU };

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
  onOpenFixedCosts,
  onNext,
  restoredFromSavedAt,
  onDiscardSavedPlan,
}: WizardStepIncomeProps) {
  const styles = useStyles();
  const savings = savingsAmount(savingsChoice, income);
  const disposable = disposableXu(income, fixed, savings);
  const days = daysInCycle(cycleStartDay);
  const perDay = perDayXu(disposable, days);
  const validation = validateIncomeStep(income, fixed, savings);

  /**
   * The one error worth showing right now, and the field it belongs under.
   *
   * ⚠️ It is rendered UNDER THE FIELD IT IS ABOUT, not in a strip at the bottom
   * of the screen. "Chi phí cố định và tiết kiệm đã vượt thu nhập" printed below
   * the result figures leaves the user scanning three fields to work out which
   * one to change — and the fixed-cost field, which is almost always the answer,
   * is the one furthest from it.
   *
   * A blank form is not a mistake, so "Thu nhập phải lớn hơn 0" stays quiet until
   * there is something to be wrong about — nobody needs to be told the form they
   * have not filled in yet is empty.
   */
  const error = validation.ok || (validation.field === "income" && income <= 0) ? null : validation;

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

        {/* Says where these numbers came from. A form that opens pre-filled with
            no explanation reads as the app having remembered something it was
            never asked to, and leaves no way back to a blank one. */}
        {restoredFromSavedAt ? (
          <View style={styles.restoredBanner}>
            <Text style={styles.restoredText}>
              Đã điền từ kế hoạch lưu ngày {formatSavedAt(restoredFromSavedAt)}.
            </Text>
            {onDiscardSavedPlan ? (
              <Pressable onPress={onDiscardSavedPlan} hitSlop={8} testID="btn-wizard-discard-plan">
                <Text style={styles.restoredAction}>Bắt đầu lại</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <MoneyField
          testID="input-wizard-income"
          label="Thu nhập hàng tháng"
          value={income}
          onChange={onChangeIncome}
          sliderScale={MONEY_SLIDER}
        />
        {error?.field === "income" ? <Text style={styles.error}>{error.message}</Text> : null}

        <MoneyField
          testID="input-wizard-fixed"
          label="Chi phí cố định"
          // Once the helper has run, the hint shows what the total is actually
          // made of instead of describing the category in the abstract — the
          // fastest way to spot that a cost is missing.
          hint={breakdown.length > 0 ? summarizeFixedCosts(breakdown) : "nhà, điện nước, internet, học phí"}
          value={fixed}
          onChange={onChangeFixed}
          sliderScale={MONEY_SLIDER}
          // Sits on the hint row because it answers the hint: the hint lists
          // what counts as fixed, and this is for the user who reads that list
          // and realises they do not know the total.
          action={{
            label: breakdown.length > 0 ? `Sửa ${breakdown.length} khoản` : "Tôi không nhớ tổng →",
            onPress: onOpenFixedCosts,
            testID: "btn-wizard-fixed-costs",
          }}
        />
        {/* Here, directly under the input it is about — this message names the
            fixed-cost total and savings together, and the fixed-cost total is the
            one the user can usually do something about. */}
        {error?.field === "fixed" ? <Text style={styles.error}>{error.message}</Text> : null}

        <WizardSavingsField
          currency={currency}
          income={income}
          savings={savings}
          choice={savingsChoice}
          onChange={onChangeSavingsChoice}
          errorMessage={error?.field === "savings" ? error.message : undefined}
        />

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

        {/* ⚠️ Only once there is an answer to show.
            The block used to render unconditionally, so a freshly opened wizard
            led with a rule, the words "Còn được chi", an em dash and a blank
            column — a summary of nothing, holding the most prominent position on
            the screen and leaving the user to work out whether it was broken or
            just empty. It earns its place the moment the figure is real.
            The live update itself is still the point: someone who abandons the
            wizard right here has still learned the most useful number in it. */}
        {disposable > 0 ? (
          <View style={styles.result}>
            <View style={styles.resultLeft}>
              <Text style={styles.label}>Còn được chi</Text>
              <Text testID="text-wizard-disposable" style={styles.resultBig}>
                {formatCurrency(disposable, currency)}
              </Text>
            </View>
            <Text testID="text-wizard-per-day" style={styles.resultPerDay}>
              {perDay > 0 ? `${formatCurrency(perDay, currency)}
mỗi ngày` : ""}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        testID="btn-wizard-next-income"
        onPress={onNext}
        disabled={!validation.ok}
        style={[styles.primaryBtn, !validation.ok && styles.primaryBtnDisabled]}
      >
        <Text style={styles.primaryLabel}>Tiếp →</Text>
      </Pressable>


    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { borderColor: colors.green, backgroundColor: withAlpha(colors.green, 0.08) },
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
  restoredBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    // Same plain hairline box as step 3's estimate notice, not a coloured
    // stripe down the left edge.
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  restoredText: { flex: 1, ...typography.tiny, color: colors.textSecondary },
  restoredAction: { ...typography.tiny, color: colors.green },
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
}));
