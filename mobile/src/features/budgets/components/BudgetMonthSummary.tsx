import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { MonthPace } from "@/features/budgets/budget-pace";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";

interface BudgetMonthSummaryProps {
  pace: MonthPace;
  /** What the elapsed share is a share OF. The card is reused under a date
   *  filter, where "% của tháng" would describe a window nobody selected. */
  periodNoun?: string;
  /** Hidden under a filter: "còn 0 ngày" is what a single-day window would
   *  honestly report, and it reads as a fault rather than a fact. */
  showDaysLeft?: boolean;
  totalLimit: number;
  totalSpent: number;
  currency: string;
  /** How many budgets in view are individually over their limit. */
  overCount?: number;
}

// The one figure this tab exists to answer — how much of this month's budgeted
// money is still unspent — above a bar that puts it against how much of the
// month is actually left. The month-pace tick is the whole point: "4.973.000
// left" means something very different on the 5th than on the 25th.
export function BudgetMonthSummary({
  pace,
  periodNoun = "tháng",
  showDaysLeft = true,
  totalLimit,
  totalSpent,
  currency,
  overCount = 0,
}: BudgetMonthSummaryProps) {
  const colors = useColors();
  const styles = useStyles();
  const remaining = totalLimit - totalSpent;
  const ratio = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const over = remaining < 0;
  // ⚠️ The total can still have room while one category is already blown —
  // other categories' unspent money is hiding it. A bright green total bar
  // sitting right above a red category bar read as the screen contradicting
  // itself, so the total is never "all clear" green while anything is over,
  // and it says why.
  const someOver = !over && overCount > 0;
  const barColor = over ? colors.peach : someOver ? colors.mustard : colors.green;

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        {showDaysLeft ? <Text style={styles.daysLeft}>còn {pace.daysLeft} ngày</Text> : null}
      </View>

      {/* ⚠️ Two lines, never one clipped one. These used to share a single
          numberOfLines={1} line, which fit at a glance but cut the limit
          mid-number ("7.210.000 đ còn lại trên 7.21…") — a figure the user
          could see was there but not read. The headline amount shrinks to fit
          its own line rather than clip; the "of the limit" line can wrap. */}
      <View style={styles.amountBlock}>
        <Text
          style={[styles.amount, over && styles.amountOver]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          testID="text-budget-summary-remaining"
        >
          {formatCurrency(Math.abs(remaining), currency)}
        </Text>
        <Text style={styles.amountSuffix}>
          {over ? "vượt trên hạn mức " : "còn lại trên hạn mức "}
          <Text style={styles.amountLimit}>{formatCurrency(totalLimit, currency)}</Text>
        </Text>
      </View>

      <BudgetProgressBar ratio={ratio} pace={pace.elapsed} color={barColor} height={10} />

      {someOver ? (
        <Text style={styles.overNote}>
          {overCount} danh mục đã vượt hạn mức — tổng vẫn còn nhờ các danh mục khác.
        </Text>
      ) : null}

    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.sm },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { ...typography.cardTitle, color: colors.textPrimary },
  daysLeft: { ...typography.caption, color: colors.textSecondary },
  amountBlock: { gap: 2 },
  amount: { ...typography.hero, color: colors.textPrimary },
  amountOver: { color: colors.peach },
  amountSuffix: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  amountLimit: { color: colors.textPrimary },
  paceLabel: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  overNote: { ...typography.caption, color: colors.mustard },
}));
