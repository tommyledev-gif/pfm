import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AmountInput } from "@/components/ui/AmountInput";
import { FieldError } from "@/components/ui/FieldError";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { BUDGET_WIZARD_PERIODS, BudgetWizardPeriod } from "@/features/budget-wizard/types";
import { WalletCurrency } from "@/lib/constants";

// spec.md S-BWZ-08's overflow guard — income (in cents) must stay below the
// dto.BudgetProposalsRequest validator's own `lte=9999999999` cap.
const MAX_INCOME_CENTS = 9_999_999_999;

const PERIOD_LABELS: Record<BudgetWizardPeriod, string> = {
  monthly: "Hàng tháng",
  weekly: "Hàng tuần",
  quarterly: "Hàng quý",
};

interface WizardStepIncomePeriodProps {
  period: BudgetWizardPeriod;
  onChangePeriod: (period: BudgetWizardPeriod) => void;
  income: string;
  onChangeIncome: (value: string) => void;
  currency: WalletCurrency;
  submitAttempted: boolean;
  onNext: () => void;
  onDismiss: () => void;
}

export function WizardStepIncomePeriod({
  period,
  onChangePeriod,
  income,
  onChangeIncome,
  currency,
  submitAttempted,
  onNext,
  onDismiss,
}: WizardStepIncomePeriodProps) {
  const incomeValue = Number(income);
  const incomeCents = Math.round(incomeValue * 100);
  const error = !income || !(incomeValue > 0)
    ? "Thu nhập phải lớn hơn 0"
    : incomeCents > MAX_INCOME_CENTS
      ? "Thu nhập vượt quá giới hạn cho phép"
      : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thu nhập & chu kỳ</Text>
      <Text style={styles.subtitle}>Cho mình biết thu nhập của bạn để đề xuất phân bổ ngân sách phù hợp.</Text>

      <Text style={styles.label}>Chu kỳ ngân sách</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {BUDGET_WIZARD_PERIODS.map((p) => (
          <Pressable
            key={p}
            testID="chip-wizard-period"
            onPress={() => onChangePeriod(p)}
            style={[styles.chip, period === p && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, period === p && styles.chipLabelActive]}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Thu nhập ({currency})</Text>
      <AmountInput value={income} onChangeText={onChangeIncome} testID="input-wizard-income" />
      {submitAttempted ? <FieldError message={error} /> : null}

      <View style={styles.actions}>
        <PillButton label="Hủy" variant="outline" onPress={onDismiss} style={styles.flexButton} />
        <PillButton label="Tiếp tục" onPress={onNext} style={styles.flexButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  chipRow: { gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  flexButton: { flex: 1 },
});
