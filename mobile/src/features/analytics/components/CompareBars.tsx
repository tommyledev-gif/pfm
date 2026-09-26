import { StyleSheet, Text, View } from "react-native";

import { AnalyticsCompare } from "@/features/analytics/types";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface CompareBarsProps {
  compare: AnalyticsCompare;
  currency: string;
}

const BAR_HEIGHT = 10;

// Q4: two periods side by side. change_pct is null when the previous period
// was zero — then no percentage is shown at all (spec.md S-AIQ-08).
export function CompareBars({ compare, currency }: CompareBarsProps) {
  const max = Math.max(compare.current, compare.previous, 1);
  const rows = [
    { key: "current", label: compare.current_label, amount: compare.current, color: colors.periwinkle },
    { key: "previous", label: compare.previous_label, amount: compare.previous, color: colors.trackMuted },
  ];
  const pct = compare.change_pct;

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.amount}>{formatCurrency(row.amount, currency)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(row.amount / max) * 100}%`, backgroundColor: row.color }]} />
          </View>
        </View>
      ))}
      {pct !== null ? (
        <Text style={[styles.change, pct > 0 ? styles.up : styles.down]}>
          {pct > 0 ? "▲" : pct < 0 ? "▼" : "="} {Math.abs(pct)}%
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  label: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.caption, color: colors.textPrimary },
  track: { height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: colors.surfaceBorder, overflow: "hidden" },
  fill: { height: BAR_HEIGHT, borderRadius: radii.pill },
  change: { ...typography.label },
  // Spending up is the cautionary direction, down the reassuring one.
  up: { color: colors.peach },
  down: { color: colors.mint },
});
