import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { formatCurrencyCompact } from "@/lib/currency";
import { formatPercent } from "@/lib/percent";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { budgetRowStatus } from "@/features/budgets/budget-pace";
import { BudgetIconTile } from "@/features/budgets/components/BudgetIconTile";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";
import { Budget, BudgetLimit } from "@/features/budgets/types";
import { categoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";

interface BudgetListRowProps {
  budget: Budget;
  limit: BudgetLimit;
  // 0..1 share of *this budget's* own period elapsed — not the month's, which
  // is only the same number for budgets that have been in force since the 1st.
  // See budgetPeriodElapsed.
  periodElapsed: number;
  category?: Category;
  onPress: (budget: Budget) => void;
  onHold: () => void;
  /** Tapping the bar itself drills into the transactions behind it — a
   *  separate target from the row's own tap, which edits the limit. */
  onPressBar: (budget: Budget, limit: BudgetLimit) => void;
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
// from the card unchanged. Amounts are short (k / m / b, formatCurrencyCompact)
// as on the Spending tab next door; the exact limit is in the edit form, the
// exact spend in the bar's transactions sheet.
export const BudgetListRow = memo(function BudgetListRow({
  budget,
  limit,
  periodElapsed,
  category,
  onPress,
  onHold,
  onPressBar,
  highlighted,
}: BudgetListRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const status = budgetRowStatus(limit, periodElapsed);
  const { start, cancel, tintStyle } = useHoldProgress(colors.textPrimary, colors.green);

  // Budget's own icon/icon_url takes precedence over its linked Category's
  // (specs/wallet-budget-icons/spec.md Edge Case US-04 #1).
  const icon = budget.icon ?? category?.icon;
  const iconUrl = budget.icon_url ?? category?.icon_url;
  const name = categoryLabel(category, budget.category_name);

  return (
    <Pressable
      onPress={() => onPress(budget)}
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
        <BudgetIconTile name={name} icon={icon} iconUrl={iconUrl} />
        <Animated.Text style={[styles.name, tintStyle]} numberOfLines={1}>
          {name}
        </Animated.Text>
        {/* What was spent, in the header's corner. Over-budget turns it red;
            otherwise it stays plain — the bar and caption below carry pace. */}
        <Text style={[styles.headline, status.over && styles.headlineOver]} numberOfLines={1}>
          {formatCurrencyCompact(limit.spent, limit.currency)}
        </Text>
      </View>

      {/* The bar is its own target: the row answers "change this limit", the
          bar answers "what is this number made of". Nested inside the row's
          Pressable rather than beside it so the layout is unchanged — RN gives
          the innermost responder the tap, so the two never both fire. */}
      <Pressable onPress={() => onPressBar(budget, limit)} hitSlop={6} testID="btn-budget-transactions">
        <BudgetProgressBar
          ratio={status.ratio}
          // A budget with nothing spent yet has no pace to be behind, and the
          // tick on an empty track just reads as noise.
          pace={status.state === "unused" ? undefined : periodElapsed}
          color={status.color}
        />

        {/* Two figures, not four: the old footer said "over budget" three
            times (385% — đã vượt, vượt 5.280.000 đ, 7.130.000 / 1.850.000). */}
        <View style={styles.footRow}>
          <Text style={[styles.caption, { color: status.over ? colors.danger : status.color }]} numberOfLines={1}>
            {t(status.over ? "budgets.row.over" : "budgets.row.left", {
              percent: formatPercent(status.ratio * 100),
              amount: formatCurrencyCompact(Math.abs(status.remaining), limit.currency),
            })}
          </Text>
          <Text style={styles.amounts} numberOfLines={1}>
            {t("budgets.row.limit", { amount: formatCurrencyCompact(limit.amount_limit, limit.currency) })}
          </Text>
        </View>

        {/* Said out loud, because a bar that happens to be tappable is a
            secret. Only on rows that have something to show — an untouched
            budget would open an empty sheet. */}
        {status.state !== "unused" ? <Text style={styles.drillLink}>{t("budgets.row.seeTransactions")}</Text> : null}
      </Pressable>
    </Pressable>
  );
});

const useStyles = createStyles((colors) => ({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  rowHighlighted: { backgroundColor: withAlpha(colors.green, 0.06) },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { flex: 1, ...typography.cardTitle },
  headline: { ...typography.body, fontWeight: "700", color: colors.textPrimary, flexShrink: 0 },
  headlineOver: { color: colors.danger },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  drillLink: { ...typography.tiny, color: colors.green, paddingTop: spacing.xs },
  caption: { ...typography.caption, flexShrink: 1 },
  amounts: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
}));
