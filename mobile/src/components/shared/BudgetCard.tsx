import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { colors, spacing, typography } from "@/lib/theme";
import { Budget, BudgetLimit } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";

// Insights → Budgets tab card — README: two stacked bars ("Budget" muted,
// "Actual" category color or peach if over), both scaled against the same
// max (the largest limit across all budgets) so lengths stay comparable,
// dollar value right-aligned next to each bar. Owns its own Pressable (tap
// opens the edit modal, 2s hold opens a category picker drawer) so it can
// drive the hold-progress color animation on its own name Text.
export function BudgetCard({
  budget,
  limit,
  maxLimit,
  category,
  color,
  onPress,
  onHold,
  highlighted,
}: {
  budget: Budget;
  limit: BudgetLimit;
  maxLimit: number;
  category?: Category;
  // Supplied by a caller rendering several budgets together (BudgetsTab),
  // which assigns colors from one collision-free map so no two cards in the
  // list share a color. Falls back to the plain per-id hash when this card
  // is rendered on its own.
  color?: string;
  onPress: () => void;
  onHold: () => void;
  highlighted?: boolean;
}) {
  const isOver = limit.status === "exceeded";
  const categoryColor = color ?? colorForCategory(budget.category_id);
  const actualColor = isOver ? colors.peach : categoryColor;
  const spentPct = limit.amount_limit > 0 ? Math.round((limit.spent / limit.amount_limit) * 100) : 0;
  const { progress, start, cancel } = useHoldProgress();
  const nameColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.textPrimary, colors.green] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={start}
      onPressOut={cancel}
      onLongPress={() => {
        cancel();
        onHold();
      }}
      delayLongPress={2000}
    >
      <Card style={[styles.card, highlighted && styles.cardHighlighted]}>
        <View style={styles.headerRow}>
          <View style={styles.nameRow}>
            {/* Budget's own icon/icon_url takes precedence over its linked
                Category's (specs/wallet-budget-icons/spec.md Edge Case US-04
                #1) — falls back to the Category's when the Budget has none
                of its own. */}
            <Avatar
              name={budget.category_name}
              color={categoryColor}
              size={28}
              icon={budget.icon ?? category?.icon}
              iconUrl={budget.icon_url ?? category?.icon_url}
            />
            <Animated.Text style={[styles.name, { color: nameColor }]}>{budget.category_name}</Animated.Text>
          </View>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  cardHighlighted: { borderWidth: 2, borderColor: colors.green },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  status: { ...typography.caption, color: colors.textSecondary },
  statusOver: { color: colors.peach },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { ...typography.tiny, color: colors.textMuted, width: 46 },
  barTrack: { flex: 1 },
  barValue: { ...typography.tiny, color: colors.textSecondary, width: 76, textAlign: "right" },
});
