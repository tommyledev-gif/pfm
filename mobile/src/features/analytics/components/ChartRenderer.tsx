import { Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { BarList } from "@/features/analytics/components/BarList";
import { BudgetStatusList } from "@/features/analytics/components/BudgetStatusList";
import { ColumnBars, fitsColumns } from "@/features/analytics/components/ColumnBars";
import { CompareBars } from "@/features/analytics/components/CompareBars";
import { DonutAnswer } from "@/features/analytics/components/DonutAnswer";
import { LineChart } from "@/features/analytics/components/LineChart";
import { NumberStat } from "@/features/analytics/components/NumberStat";
import { RankedList } from "@/features/analytics/components/RankedList";
import { AnalyticsChart } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface ChartRendererProps {
  chart: AnalyticsChart;
  currency: string;
  /** 0..1 of the answer's period gone by — budget bars draw it as their pace tick. */
  elapsed: number;
}

// A daily line needs enough points to be a line rather than two dots.
const MIN_LINE_POINTS = 3;

// Picks the visual for an answer. Every branch draws only figures the backend
// computed — nothing here derives a new amount. An unknown type (an answer
// stored by a newer app version) falls back to a plain list of whatever
// figures it carries, never a blank bubble (spec.md S-AIQ-43).
export function ChartRenderer({ chart, currency, elapsed }: ChartRendererProps) {
  const styles = useStyles();
  const body = (() => {
    switch (chart.type) {
      case "none":
        return null;
      case "number":
        if (chart.value === undefined) return <FallbackList chart={chart} currency={currency} elapsed={elapsed} />;
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
        // Columns only when every label fits under one; names (Wallets) get
        // full-width rows instead of being cut to "…".
        if (!chart.items) return null;
        return fitsColumns(chart.items) ? (
          <ColumnBars items={chart.items} currency={currency} />
        ) : (
          <BarList items={chart.items} currency={currency} />
        );
      case "line":
        return chart.items ? <LineChart items={chart.items} currency={currency} /> : null;
      case "compare":
        return chart.compare ? <CompareBars compare={chart.compare} currency={currency} /> : null;
      case "table":
        return chart.rows ? (
          <RankedList rows={chart.rows} moreRows={chart.more_rows} currency={currency} totalMatched={chart.total_matched} />
        ) : null;
      case "progress":
        return chart.budgets ? <BudgetStatusList budgets={chart.budgets} currency={currency} elapsed={elapsed} /> : null;
      default:
        return <FallbackList chart={chart} currency={currency} elapsed={elapsed} />;
    }
  })();

  if (!body) return null;
  // The one surface in an answer: the reply text sits on the app's own
  // ground, only the data gets a raised tone — no border, no card in a card.
  // A list's rows already carry their own vertical padding.
  return (
    <View testID={`chart-analytics-${chart.type}`} style={[styles.surface, (chart.rows || chart.budgets) && styles.surfaceList]}>
      {body}
    </View>
  );
}

function FallbackList({ chart, currency, elapsed }: ChartRendererProps) {
  const styles = useStyles();
  if (chart.rows) {
    return <RankedList rows={chart.rows} moreRows={chart.more_rows} currency={currency} totalMatched={chart.total_matched} />;
  }
  if (chart.budgets) return <BudgetStatusList budgets={chart.budgets} currency={currency} elapsed={elapsed} />;
  const lines = chart.items ?? [];
  return (
    <View style={styles.stack}>
      {chart.value !== undefined ? <NumberStat value={chart.value} currency={currency} /> : null}
      {lines.map((item) => (
        <View key={item.key} style={styles.fallbackRow}>
          <Text style={styles.fallbackLabel}>{item.label}</Text>
          <AmountText amountCents={item.amount} currency={currency} style={styles.fallbackAmount} />
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  surface: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radii.listCard, backgroundColor: colors.surface },
  surfaceList: { paddingVertical: spacing.xs },
  stack: { gap: spacing.md },
  fallbackRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  fallbackLabel: { ...typography.label, color: colors.textSecondary, flex: 1 },
  fallbackAmount: { ...typography.label, color: colors.textPrimary },
}));
