import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { CompareBars } from "@/features/analytics/components/CompareBars";
import { NumberStat } from "@/features/analytics/components/NumberStat";
import { RankedList } from "@/features/analytics/components/RankedList";
import { AnalyticsAnomaly, AnalyticsAnomalyCategory, AnalyticsChart } from "@/features/analytics/types";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface AnomalyAnswerProps {
  chart: AnalyticsChart;
  anomaly: AnalyticsAnomaly;
  currency: string;
}

// "Có gì bất thường hôm nay?" — the period against its usual (two bars, the
// same CompareBars as Q4), then what stands out: Categories far above their
// usual, unusually large expenses, an income larger than any before. The
// reply text above already names the most telling of them; this is the full
// list. Every figure comes from the backend; nothing here derives an amount.
// Lists may be absent (nothing found, or too little history to compare).
export function AnomalyAnswer({ chart, anomaly, currency }: AnomalyAnswerProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const categories = anomaly.categories ?? [];
  const large = chart.rows ?? [];
  const income = anomaly.income ?? [];
  const showCount = anomaly.count_spike && anomaly.typical_count !== undefined;

  return (
    <View testID="chart-analytics-anomaly-body" style={styles.stack}>
      {chart.compare ? (
        <CompareBars compare={chart.compare} currency={currency} />
      ) : (
        <NumberStat value={anomaly.total} currency={currency} caption={t("analytics.anomaly.count", { count: anomaly.count })} />
      )}
      {showCount ? (
        <Text style={styles.caption}>
          {t("analytics.anomaly.countVsUsual", { count: anomaly.count, usual: anomaly.typical_count })}
        </Text>
      ) : null}

      {categories.length > 0 ? (
        <Section title={t("analytics.anomaly.aboveUsual")}>
          {categories.map((c, i) => (
            <CategoryRow key={c.category_id} item={c} first={i === 0} currency={currency} baseline={anomaly.baseline_label} />
          ))}
        </Section>
      ) : null}
      {large.length > 0 ? (
        <Section title={t("analytics.anomaly.largeExpenses")}>
          <RankedList rows={large} currency={currency} />
        </Section>
      ) : null}
      {income.length > 0 ? (
        <Section title={t("analytics.anomaly.largeIncome")}>
          <RankedList rows={income} currency={currency} />
        </Section>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.caption}>{title}</Text>
      {children}
    </View>
  );
}

interface CategoryRowProps {
  item: AnalyticsAnomalyCategory;
  first: boolean;
  currency: string;
  baseline: string;
}

// "Ăn uống 450.000 ₫ / Thường 120.000 ₫", or, for a Category with no
// spending in the whole baseline, "Không có trong 8 tuần trước đó".
function CategoryRow({ item, first, currency, baseline }: CategoryRowProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const usual =
    item.typical !== undefined
      ? t("analytics.anomaly.usualAmount", { amount: formatCurrency(item.typical, currency) })
      : t("analytics.anomaly.noneInBaseline", { baseline });
  return (
    <View testID={`row-analytics-anomaly-${item.category_id}`} style={[styles.row, !first && styles.divider]}>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {item.category_name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {usual}
        </Text>
      </View>
      <AmountText amountCents={item.amount} currency={currency} style={styles.amount} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  stack: { gap: spacing.md },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder, paddingTop: spacing.md },
  caption: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  middle: { flex: 1 },
  name: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.body, color: colors.textPrimary },
}));
