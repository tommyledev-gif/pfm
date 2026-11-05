import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

const BAR_HEIGHT = 6;

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
  /** Draws the hairline above this row (every row of the group but the first). */
  separated?: boolean;
}

// One budget in the Insights → Budgets list: a row of the tab's rounded group.
//
// Two lines beside the icon, nothing more: the name with what was spent of the
// limit ("1,2tr / 2tr"), then the bar with what is left (or over) and the
// share used. It used to stack five things per budget — name and spend, the
// bar, "37% · Còn 1,2tr" with "Hạn mức: 2tr" under it, and a "Xem giao dịch →"
// link — and a handful of budgets filled the screen.
//
// The bar (with its line) still opens the transactions behind it; screen
// readers hear it as "Xem giao dịch". A single bar scaled to *its own* limit,
// coloured by pace state, with its own period tick. Tap-to-edit and the 2s
// hold that opens the category picker are unchanged. Amounts are short
// (k / m / b, formatCurrencyCompact); the exact limit is in the edit form,
// the exact spend in the bar's transactions sheet.
export const BudgetListRow = memo(function BudgetListRow({
  budget,
  limit,
  periodElapsed,
  category,
  onPress,
  onHold,
  onPressBar,
  highlighted,
  separated,
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
      <BudgetIconTile name={name} icon={icon} iconUrl={iconUrl} />
      <View style={[styles.body, separated && styles.separated]}>
        <View style={styles.line}>
          <Animated.Text style={[styles.name, tintStyle]} numberOfLines={1}>
            {name}
          </Animated.Text>
          <Text style={[styles.amounts, status.over && styles.amountsOver]} numberOfLines={1}>
            {t("budgets.row.spentOfLimit", {
              spent: formatCurrencyCompact(limit.spent, limit.currency),
              limit: formatCurrencyCompact(limit.amount_limit, limit.currency),
            })}
          </Text>
        </View>

        {/* Its own target, nested so RN gives it the tap over the row's. */}
        <Pressable
          onPress={() => onPressBar(budget, limit)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("budgets.row.seeTransactions")}
          testID="btn-budget-transactions"
          style={styles.barBlock}
        >
          <BudgetProgressBar
            ratio={status.ratio}
            // A budget with nothing spent yet has no pace to be behind, and the
            // tick on an empty track just reads as noise.
            pace={status.state === "unused" ? undefined : periodElapsed}
            color={status.color}
            height={BAR_HEIGHT}
          />
          <View style={styles.line}>
            <Text style={[styles.caption, { color: status.over ? colors.danger : status.color }]} numberOfLines={1}>
              {t(status.over ? "budgets.row.over" : "budgets.row.left", {
                amount: formatCurrencyCompact(Math.abs(status.remaining), limit.currency),
              })}
            </Text>
            <Text style={styles.percent} numberOfLines={1}>
              {formatPercent(status.ratio * 100)}
            </Text>
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
});

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg },
  rowHighlighted: { backgroundColor: withAlpha(colors.green, 0.06) },
  // The hairline starts after the icon, as in every other inset group.
  body: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  // Name and figures share a line; the name gives way (see yoga note in PendingRow).
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, ...typography.body },
  amounts: { ...typography.caption, color: colors.textSecondary, flexShrink: 0 },
  amountsOver: { color: colors.danger },
  barBlock: { gap: 6 },
  caption: { ...typography.caption, flexShrink: 1 },
  percent: { ...typography.caption, color: colors.textMuted, flexShrink: 0 },
}));
