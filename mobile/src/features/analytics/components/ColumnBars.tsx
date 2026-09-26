import { StyleSheet, Text, View } from "react-native";

import { AnalyticsChartItem } from "@/features/analytics/types";
import { formatCurrencyCompact } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface ColumnBarsProps {
  items: AnalyticsChartItem[];
  currency: string;
}

const BAR_AREA_HEIGHT = 96;
// A zero day still shows a sliver, so seven bars always read as seven days.
const MIN_BAR_HEIGHT = 2;

// Vertical bars for per-cycle totals (Q3), per-Wallet totals (Q8) and the
// weekday pattern (Q13). Heights are relative to the largest bar; the
// figure sits above each bar.
export function ColumnBars({ items, currency }: ColumnBarsProps) {
  const max = Math.max(...items.map((i) => i.amount), 1);
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.key} style={styles.column}>
          <Text style={styles.amount} numberOfLines={1}>
            {item.amount > 0 ? formatCurrencyCompact(item.amount, currency) : ""}
          </Text>
          <View style={styles.barArea}>
            <View style={[styles.bar, { height: Math.max(MIN_BAR_HEIGHT, (item.amount / max) * BAR_AREA_HEIGHT) }]} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  column: { flex: 1, alignItems: "center", gap: spacing.xs },
  amount: { ...typography.tiny, color: colors.textSecondary },
  barArea: { height: BAR_AREA_HEIGHT, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  bar: { width: "70%", backgroundColor: colors.periwinkle, borderRadius: radii.pill },
  label: { ...typography.tiny, color: colors.textMuted },
});
