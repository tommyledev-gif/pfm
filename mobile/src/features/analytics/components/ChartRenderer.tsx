import { StyleSheet, Text, View } from "react-native";

import { BudgetStatusList } from "@/features/analytics/components/BudgetStatusList";
import { ColumnBars } from "@/features/analytics/components/ColumnBars";
import { CompareBars } from "@/features/analytics/components/CompareBars";
import { DonutAnswer } from "@/features/analytics/components/DonutAnswer";
import { LineChart } from "@/features/analytics/components/LineChart";
import { NumberStat } from "@/features/analytics/components/NumberStat";
import { RankedList } from "@/features/analytics/components/RankedList";
import { AnalyticsChart } from "@/features/analytics/types";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface ChartRendererProps {
  chart: AnalyticsChart;
  currency: string;
}

// A daily line needs enough points to be a line rather than two dots.
const MIN_LINE_POINTS = 3;

// Picks the visual for an answer. Every branch draws only figures the backend
// computed — nothing here derives a new amount. An unknown type (an answer
// stored by a newer app version) falls back to a plain list of whatever
// figures it carries, never a blank bubble (spec.md S-AIQ-43).
export function ChartRenderer({ chart, currency }: ChartRendererProps) {
  const body = (() => {
    switch (chart.type) {
      case "none":
        return null;
      case "number":
        if (chart.value === undefined) return <FallbackList chart={chart} currency={currency} />;
        return (
          <View style={styles.stack}>
            <NumberStat
              value={chart.value}
              currency={currency}
              caption={chart.days !== undefined ? `trung bình trên ${chart.days} ngày có chi tiêu` : undefined}
            />
            {chart.items && chart.items.length >= MIN_LINE_POINTS ? (
              <LineChart items={chart.items} currency={currency} />
            ) : null}
          </View>
        );
      case "donut":
        return chart.items ? <DonutAnswer items={chart.items} currency={currency} /> : null;
      case "bar":
      case "weekday":
        return chart.items ? <ColumnBars items={chart.items} currency={currency} /> : null;
      case "line":
        return chart.items ? <LineChart items={chart.items} currency={currency} /> : null;
      case "compare":
        return chart.compare ? <CompareBars compare={chart.compare} currency={currency} /> : null;
      case "table":
        return chart.rows ? <RankedList rows={chart.rows} currency={currency} totalMatched={chart.total_matched} /> : null;
      case "progress":
        return chart.budgets ? <BudgetStatusList budgets={chart.budgets} currency={currency} /> : null;
      default:
        return <FallbackList chart={chart} currency={currency} />;
    }
  })();

  if (!body) return null;
  return (
    <View testID={`chart-analytics-${chart.type}`} style={styles.wrap}>
      {body}
    </View>
  );
}

function FallbackList({ chart, currency }: ChartRendererProps) {
  if (chart.rows) return <RankedList rows={chart.rows} currency={currency} totalMatched={chart.total_matched} />;
  if (chart.budgets) return <BudgetStatusList budgets={chart.budgets} currency={currency} />;
  const lines = chart.items ?? [];
  return (
    <View style={styles.stack}>
      {chart.value !== undefined ? <NumberStat value={chart.value} currency={currency} /> : null}
      {lines.map((item) => (
        <View key={item.key} style={styles.fallbackRow}>
          <Text style={styles.fallbackLabel}>{item.label}</Text>
          <Text style={styles.fallbackAmount}>{formatCurrency(item.amount, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  stack: { gap: spacing.md },
  fallbackRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  fallbackLabel: { ...typography.label, color: colors.textSecondary, flex: 1 },
  fallbackAmount: { ...typography.label, color: colors.textPrimary },
});
