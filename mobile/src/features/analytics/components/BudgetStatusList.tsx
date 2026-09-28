import { StyleSheet, Text, View } from "react-native";

import { AnalyticsBudgetItem } from "@/features/analytics/types";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface BudgetStatusListProps {
  budgets: AnalyticsBudgetItem[];
  currency: string;
}

// Q9 — the same numbers as the Budgets screen (spec.md S-AIQ-09), drawn with
// the same bar so the two never look like different measurements.
export function BudgetStatusList({ budgets, currency }: BudgetStatusListProps) {
  return (
    <View style={styles.wrap}>
      {budgets.map((b) => (
        <View key={b.budget_id} style={styles.row}>
          <View style={styles.head}>
            <Text style={styles.name} numberOfLines={1}>
              {b.category_name}
            </Text>
            <Text style={[styles.remaining, b.exceeded ? styles.over : null]}>
              {b.exceeded
                ? `Vượt ${formatCurrency(b.spent - b.limit, currency)}`
                : `Còn ${formatCurrency(b.remaining, currency)}`}
            </Text>
          </View>
          <BudgetProgressBar
            ratio={b.limit > 0 ? b.spent / b.limit : 0}
            color={b.exceeded ? colors.peach : colors.green}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: spacing.xs },
  head: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.label, color: colors.textPrimary, flex: 1 },
  remaining: { ...typography.caption, color: colors.textSecondary },
  over: { color: colors.peach },
});
