import { StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";
import { MonthPace } from "@/features/budgets/budget-pace";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";

interface BudgetMonthSummaryProps {
  pace: MonthPace;
  totalLimit: number;
  totalSpent: number;
  currency: string;
}

// The one figure this tab exists to answer — how much of this month's budgeted
// money is still unspent — above a bar that puts it against how much of the
// month is actually left. The month-pace tick is the whole point: "4.973.000
// left" means something very different on the 5th than on the 25th.
export function BudgetMonthSummary({ pace, totalLimit, totalSpent, currency }: BudgetMonthSummaryProps) {
  const remaining = totalLimit - totalSpent;
  const ratio = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const over = remaining < 0;

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <Text style={styles.month}>{pace.label}</Text>
        <Text style={styles.daysLeft}>còn {pace.daysLeft} ngày</Text>
      </View>

      <Text style={styles.amountRow} numberOfLines={1}>
        <Text style={[styles.amount, over && styles.amountOver]}>{formatCurrency(Math.abs(remaining), currency)}</Text>
        <Text style={styles.amountSuffix}>
          {over ? " vượt trên " : " còn lại trên "}
          {formatCurrency(totalLimit, currency)}
        </Text>
      </Text>

      <BudgetProgressBar ratio={ratio} pace={pace.elapsed} color={over ? colors.peach : colors.green} height={10} />

      <Text style={styles.paceLabel}>{Math.round(pace.elapsed * 100)}% của tháng đã trôi qua</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { ...typography.cardTitle, color: colors.textPrimary },
  daysLeft: { ...typography.caption, color: colors.textSecondary },
  amountRow: { flexDirection: "row", alignItems: "baseline" },
  amount: { ...typography.hero, color: colors.textPrimary },
  amountOver: { color: colors.peach },
  amountSuffix: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  paceLabel: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
});
