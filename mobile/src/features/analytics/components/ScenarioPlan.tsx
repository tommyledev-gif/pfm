import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { ConsultScenario } from "@/features/analytics/types";
import { formatDateShort } from "@/lib/format-date";
import { spacing, typography, createStyles } from "@/lib/theme";

interface ScenarioPlanProps {
  scenario: ConsultScenario;
}

// A savings-goal plan: the monthly amount to set aside first, then the
// spending cap it implies against recent averages. The sentence above says
// the same in words; this is the glanceable version.
export function ScenarioPlan({ scenario }: ScenarioPlanProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { currency } = scenario;
  const short = scenario.feasible === false;

  return (
    <View testID="card-analytics-scenario" style={styles.wrap}>
      <AmountText amountCents={scenario.monthly_save} currency={currency} style={styles.value} />
      <Text style={styles.caption}>
        {scenario.deadline
          ? t("analytics.scenario.captionDeadline", { count: scenario.months, date: formatDateShort(scenario.deadline) })
          : t("analytics.scenario.caption", { count: scenario.months })}
      </Text>

      <View style={styles.rows}>
        <Row label={t("analytics.scenario.goal")} amount={scenario.goal} currency={currency} />
        {scenario.avg_income !== undefined ? <Row label={t("analytics.scenario.avgIncome")} amount={scenario.avg_income} currency={currency} /> : null}
        {scenario.avg_expense !== undefined ? <Row label={t("analytics.scenario.avgSpending")} amount={scenario.avg_expense} currency={currency} /> : null}
        {scenario.spend_cap !== undefined && scenario.spend_cap > 0 ? (
          <Row label={t("analytics.scenario.spendCap")} amount={scenario.spend_cap} currency={currency} strong />
        ) : null}
        {short && scenario.cut_needed ? <Row label={t("analytics.scenario.cutNeeded")} amount={scenario.cut_needed} currency={currency} warn /> : null}
      </View>
    </View>
  );
}

interface RowProps {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
  warn?: boolean;
}

function Row({ label, amount, currency, strong, warn }: RowProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <AmountText
        amountCents={amount}
        currency={currency}
        style={[styles.amount, strong && styles.strong, warn && styles.warn]}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.xs, marginTop: spacing.sm },
  value: { ...typography.title, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  rows: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.caption, color: colors.textPrimary },
  strong: { color: colors.green },
  warn: { color: colors.danger },
}));
