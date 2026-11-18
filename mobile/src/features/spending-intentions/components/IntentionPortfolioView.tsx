import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { budgetLines } from "@/features/spending-intentions/intention-lines";
import { intentionMonthLabel } from "@/features/spending-intentions/intention-draft";
import { IntentionBudgetLoad, IntentionMonthLoad, IntentionPortfolio } from "@/features/spending-intentions/types";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

// Months shown before "and N more": the sheet is read in a glance, and a plan
// that runs a year would otherwise be twelve identical blocks.
const MONTHS_SHOWN = 6;

interface IntentionPortfolioViewProps {
  portfolio: IntentionPortfolio;
  testID?: string;
}

/**
 * Everything planned, weighed together (spec.md A-08): what the User usually
 * earns and spends, then each month that pays something against the surplus
 * and against every Budget the plans touch. Two plans in one Category are one
 * line against one Budget, three plans in one month one line against one
 * surplus. Numbers against the User's own limits and history, no advice.
 */
export function IntentionPortfolioView({ portfolio, testID }: IntentionPortfolioViewProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { currency } = portfolio;
  const shown = portfolio.months.slice(0, MONTHS_SHOWN);
  const hidden = portfolio.months.length - shown.length;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.title}>{t("intentions.portfolio.title", { count: portfolio.count })}</Text>

      {portfolio.surplus === undefined ? (
        <Text style={styles.note}>{t("intentions.lines.noHistory")}</Text>
      ) : (
        <View style={styles.rows}>
          {portfolio.avg_income !== undefined ? <Row label={t("intentions.portfolio.avgIncome")} amount={portfolio.avg_income} currency={currency} /> : null}
          {portfolio.avg_expense !== undefined ? <Row label={t("intentions.portfolio.avgExpense")} amount={portfolio.avg_expense} currency={currency} /> : null}
          <Row label={t("intentions.lines.surplus")} amount={portfolio.surplus} currency={currency} strong />
        </View>
      )}

      {shown.map((month) => (
        <MonthBlock key={month.month} month={month} currency={currency} />
      ))}
      {hidden > 0 ? <Text style={styles.note}>{t("intentions.portfolio.moreMonths", { count: hidden })}</Text> : null}
    </View>
  );
}

function MonthBlock({ month, currency }: { month: IntentionMonthLoad; currency: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.month} testID={`portfolio-month-${month.month}`}>
      <View style={styles.monthHead}>
        <Text style={styles.monthName}>{intentionMonthLabel(month.month)}</Text>
        <Text style={styles.planned}>{t("intentions.portfolio.planned", { amount: formatCurrency(month.planned, currency) })}</Text>
      </View>
      {month.fits_surplus !== undefined ? (
        <Verdict
          fits={month.fits_surplus}
          label={month.fits_surplus ? t("intentions.lines.fitsSurplus") : t("intentions.lines.shortSurplus", { amount: formatCurrency(month.short_surplus ?? 0, currency) })}
        />
      ) : null}
      {month.budgets.map((budget) => (
        <BudgetBlock key={budget.category_name} budget={budget} currency={currency} />
      ))}
    </View>
  );
}

function BudgetBlock({ budget, currency }: { budget: IntentionBudgetLoad; currency: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  // The same lines a single plan shows, with "other plans" meaning all of them here.
  const lines = budgetLines(t, budget, currency).filter((line) => line.key === "budget");
  return (
    <View style={styles.budget}>
      {lines.map((line) =>
        line.type === "amount" ? <Row key={line.key} label={line.label} amount={line.amount} currency={currency} /> : null,
      )}
      <Row label={t("intentions.portfolio.budgetPlanned", { category: budget.category_name })} amount={budget.other_planned} currency={currency} />
      {budget.fits !== undefined ? (
        <Verdict
          fits={budget.fits}
          label={budget.fits ? t("intentions.lines.fitsBudget") : t("intentions.lines.shortBudget", { amount: formatCurrency(budget.short ?? 0, currency) })}
        />
      ) : null}
    </View>
  );
}

function Verdict({ fits, label }: { fits: boolean; label: string }) {
  const styles = useStyles();
  return <Text style={[styles.verdict, fits ? styles.fits : styles.short]}>{label}</Text>;
}

function Row({ label, amount, currency, strong }: { label: string; amount: number; currency: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <AmountText amountCents={amount} currency={currency} style={[styles.amount, strong && styles.strong]} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.sm },
  title: { ...typography.label, color: colors.textPrimary },
  rows: { gap: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  amount: { ...typography.caption, color: colors.textPrimary },
  strong: { color: colors.green },
  month: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  monthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md },
  monthName: { ...typography.caption, color: colors.textPrimary },
  planned: { ...typography.caption, color: colors.textSecondary },
  budget: { gap: 2 },
  verdict: { ...typography.caption },
  fits: { color: colors.green },
  short: { color: colors.peach },
  note: { ...typography.caption, color: colors.textMuted },
}));
