import { Text, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";

import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { formatCurrencyCompact } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";

interface BudgetMonthSummaryProps {
  /** 0..1 of the window gone: the bar's tick. */
  elapsed: number;
  totalLimit: number;
  totalSpent: number;
  currency: string;
  /** How many budgets in view are individually over their limit. */
  overCount?: number;
}

// The one figure this tab exists to answer — how much of the budgeted money is
// still unspent — above a bar that puts it against how much of the window is
// gone. The tick is the whole point: "4.973.000 left" means something very
// different on the 5th than on the 25th.
//
// The body of the tab's summary card, under its range line (BudgetRangeRow,
// which also says how many days are left). Three lines at most: the figure
// with its limit, the bar, and a note only when a category is over.
export function BudgetMonthSummary({ elapsed, totalLimit, totalSpent, currency, overCount = 0 }: BudgetMonthSummaryProps) {
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
  // and it says so.
  const someOver = !over && overCount > 0;
  const barColor = over ? colors.peach : someOver ? colors.mustard : colors.green;

  return (
    <View style={styles.container}>
      {/* The figure and what it is out of, on one line when they fit. Short
          figures (k / m / b); holding the big one shows it exact. */}
      <View style={styles.amountLine}>
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

      <BudgetProgressBar ratio={ratio} pace={elapsed} color={barColor} />

      {someOver ? <Text style={styles.overNote}>{t("budgets.summary.someOver", { count: overCount })}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.sm },
  amountLine: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: spacing.sm },
  // The hold target hugs the figure instead of the whole row.
  amountTarget: { alignSelf: "flex-start" },
  amount: { ...typography.hero, fontSize: 26, color: colors.textPrimary },
  amountOver: { color: colors.peach },
  amountSuffix: { ...typography.caption, color: colors.textSecondary },
  amountLimit: { color: colors.textPrimary },
  overNote: { ...typography.caption, color: colors.mustard },
}));
