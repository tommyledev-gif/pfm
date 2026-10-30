import { Text, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";

import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { formatCurrencyCompact } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { MonthPace } from "@/features/budgets/budget-pace";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";

interface BudgetMonthSummaryProps {
  pace: MonthPace;
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
  showDaysLeft = true,
  totalLimit,
  totalSpent,
  currency,
  overCount = 0,
}: BudgetMonthSummaryProps) {
  const { t } = useTranslation();
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
        {showDaysLeft ? <Text style={styles.daysLeft}>{t("budgets.summary.daysLeft", { count: pace.daysLeft })}</Text> : null}
      </View>

      {/* ⚠️ Two lines, never one clipped one. These used to share a single
          numberOfLines={1} line, which fit at a glance but cut the limit
          mid-number ("7.210.000 đ còn lại trên 7.21…") — a figure the user
          could see was there but not read. Both figures are short now
          (k / m / b, as on the Spending tab); holding the headline shows it
          exact. The "of the limit" line can wrap. */}
      <View style={styles.amountBlock}>
        <RevealableAmount
          amountCents={Math.abs(remaining)}
          currency={currency}
          style={[styles.amount, over && styles.amountOver]}
          containerStyle={styles.amountTarget}
          testID="text-budget-summary-remaining"
        />
        <Text style={styles.amountSuffix}>
          <Trans
            t={t}
            i18nKey={over ? "budgets.summary.overLimit" : "budgets.summary.leftOfLimit"}
            values={{ limit: formatCurrencyCompact(totalLimit, currency) }}
            components={[<Text key="limit" style={styles.amountLimit} />]}
          />
        </Text>
      </View>

      <BudgetProgressBar ratio={ratio} pace={pace.elapsed} color={barColor} height={10} />

      {someOver ? (
        <Text style={styles.overNote}>{t("budgets.summary.someOver", { count: overCount })}</Text>
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
  // The hold target hugs the figure instead of the whole row.
  amountTarget: { alignSelf: "flex-start" },
  amount: { ...typography.hero, color: colors.textPrimary },
  amountOver: { color: colors.peach },
  amountSuffix: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  amountLimit: { color: colors.textPrimary },
  paceLabel: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  overNote: { ...typography.caption, color: colors.mustard },
}));
