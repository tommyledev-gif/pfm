import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { initialFor } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { budgetRowStatus } from "@/features/budgets/budget-pace";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";
import { Budget, BudgetLimit } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";

interface BudgetListRowProps {
  budget: Budget;
  limit: BudgetLimit;
  // 0..1 share of *this budget's* own period elapsed — not the month's, which
  // is only the same number for budgets that have been in force since the 1st.
  // See budgetPeriodElapsed.
  periodElapsed: number;
  category?: Category;
  onPress: () => void;
  onHold: () => void;
  /** Tapping the bar itself drills into the transactions behind it — a
   *  separate target from the row's own tap, which edits the limit. */
  onPressBar: () => void;
  highlighted?: boolean;
}

// One budget in the Insights → Budgets list.
//
// Replaces the old two-bar card ("Budget" muted over "Actual" colored, both
// scaled against the largest limit in the list). That card answered "how big
// is this budget relative to the others", which is not a question anyone opens
// this screen with; it took a full Card of vertical space per budget, and it
// never showed whether spending was ahead of the month. This row answers
// "am I fine" in one glance instead: a single bar scaled to *its own* limit,
// colored by pace state, with its own period tick drawn on it, the money left (or
// overspent) called out on the right, and the raw spent/limit pair underneath.
//
// Tap-to-edit and the 2s hold that opens the category picker are carried over
// from the card unchanged.
export function BudgetListRow({
  budget,
  limit,
  periodElapsed,
  category,
  onPress,
  onHold,
  onPressBar,
  highlighted,
}: BudgetListRowProps) {
  const status = budgetRowStatus(limit, periodElapsed);
  const { progress, start, cancel } = useHoldProgress();
  const nameColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.textPrimary, colors.green] });

  // Budget's own icon/icon_url takes precedence over its linked Category's
  // (specs/wallet-budget-icons/spec.md Edge Case US-04 #1).
  const icon = budget.icon ?? category?.icon;
  const iconUrl = budget.icon_url ?? category?.icon_url;

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
      style={[styles.row, highlighted && styles.rowHighlighted]}
    >
      <View style={styles.headRow}>
        {/* Uniform neutral tile rather than a per-category colored circle:
            color is what tells this list apart at a glance, and it is spent
            entirely on pace state here. Two color systems in one row would
            fight each other. */}
        <View style={styles.icon}>
          {iconUrl ? (
            <Image source={{ uri: iconUrl }} style={styles.iconImage} />
          ) : (
            <Text style={styles.iconGlyph}>{icon || initialFor(budget.category_name)}</Text>
          )}
        </View>
        <Animated.Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>
          {budget.category_name}
        </Animated.Text>
        <Text style={[styles.headline, { color: status.color }]} numberOfLines={1}>
          {status.over ? "vượt " : "còn "}
          {formatCurrency(Math.abs(status.remaining), limit.currency)}
        </Text>
      </View>

      {/* The bar is its own target: the row answers "change this limit", the
          bar answers "what is this number made of". Nested inside the row's
          Pressable rather than beside it so the layout is unchanged — RN gives
          the innermost responder the tap, so the two never both fire. */}
      <Pressable onPress={onPressBar} hitSlop={6} testID="btn-budget-transactions">
        <BudgetProgressBar
          ratio={status.ratio}
          // A budget with nothing spent yet has no pace to be behind, and the
          // tick on an empty track just reads as noise.
          pace={status.state === "unused" ? undefined : periodElapsed}
          color={status.color}
        />

        <View style={styles.footRow}>
          <Text style={[styles.caption, { color: status.color }]} numberOfLines={1}>
            {status.percent}% — {status.caption}
          </Text>
          <Text style={styles.amounts} numberOfLines={1}>
            {formatCurrency(limit.spent, limit.currency)} / {formatCurrency(limit.amount_limit, limit.currency)}
          </Text>
        </View>

        {/* Said out loud, because a bar that happens to be tappable is a
            secret. Only on rows that have something to show — an untouched
            budget would open an empty sheet. */}
        {status.state !== "unused" ? <Text style={styles.drillLink}>Xem giao dịch →</Text> : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  rowHighlighted: { backgroundColor: "rgba(133,255,51,0.06)" },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: { width: 36, height: 36, borderRadius: radii.pill },
  iconGlyph: { fontSize: 16, color: colors.textPrimary, fontWeight: "700" },
  name: { flex: 1, ...typography.cardTitle },
  headline: { ...typography.cardTitle, flexShrink: 0 },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  drillLink: { ...typography.tiny, color: colors.green, paddingTop: spacing.xs },
  caption: { ...typography.caption },
  amounts: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
});
