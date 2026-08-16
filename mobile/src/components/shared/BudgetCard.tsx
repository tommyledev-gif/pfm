import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";
import { Budget, BudgetLimit } from "@/features/budgets/types";

// Insights → Budgets tab card — README: two stacked bars ("Budget" muted,
// "Actual" category color or peach if over), both scaled against the same
// max (the largest limit across all budgets) so lengths stay comparable,
// dollar value right-aligned next to each bar.
export function BudgetCard({ budget, limit, maxLimit }: { budget: Budget; limit: BudgetLimit; maxLimit: number }) {
  const isOver = limit.status === "exceeded";
  const categoryColor = colorForCategory(budget.category_id);
  const actualColor = isOver ? colors.peach : categoryColor;
  const spentPct = limit.amount_limit > 0 ? Math.round((limit.spent / limit.amount_limit) * 100) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{budget.category_name}</Text>
        <Text style={[styles.status, isOver && styles.statusOver]}>{isOver ? "Over budget" : `${spentPct}% used`}</Text>
      </View>

      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Budget</Text>
        <View style={styles.barTrack}>
          <ProgressBar progress={limit.amount_limit / maxLimit} color={colors.trackMuted} height={10} />
        </View>
        <Text style={styles.barValue}>{formatCurrency(limit.amount_limit, limit.currency)}</Text>
      </View>

      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Actual</Text>
        <View style={styles.barTrack}>
          <ProgressBar progress={limit.spent / maxLimit} color={actualColor} height={10} />
        </View>
        <Text style={styles.barValue}>{formatCurrency(limit.spent, limit.currency)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  status: { ...typography.caption, color: colors.textSecondary },
  statusOver: { color: colors.peach },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { ...typography.tiny, color: colors.textMuted, width: 46 },
  barTrack: { flex: 1 },
  barValue: { ...typography.tiny, color: colors.textSecondary, width: 76, textAlign: "right" },
});
