import { Animated, Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { AnalyticsCompare } from "@/features/analytics/types";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

interface CompareBarsProps {
  compare: AnalyticsCompare;
  currency: string;
}

const BAR_HEIGHT = 8;
// The earlier period is context, not the subject — same hue, stepped back.
const PREVIOUS_ALPHA = 0.4;

// "Tăng 12% so với T8/26" — the direction in words. A lone "▲ 12%" left the
// reader to work out what it was compared with.
function changeText(pct: number, previousLabel: string): string {
  if (pct === 0) return `Không đổi so với ${previousLabel}`;
  return `${pct > 0 ? "Tăng" : "Giảm"} ${Math.abs(pct)}% so với ${previousLabel}`;
}

// Q4: two periods side by side, in the same row grammar as BarList (label and
// exact amount over a bar scaled to the larger one). change_pct is null when
// the previous period was zero — then no percentage is shown at all
// (spec.md S-AIQ-08).
export function CompareBars({ compare, currency }: CompareBarsProps) {
  const colors = useColors();
  const styles = useStyles();
  const max = Math.max(compare.current, compare.previous, 1);
  const grow = useEntryAnimation();
  const rows = [
    { key: "current", label: compare.current_label, amount: compare.current, color: colors.periwinkle },
    {
      key: "previous",
      label: compare.previous_label,
      amount: compare.previous,
      color: withAlpha(colors.periwinkle, PREVIOUS_ALPHA),
    },
  ];
  const pct = compare.change_pct;

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.head}>
            <Text style={styles.label} numberOfLines={1}>
              {row.label}
            </Text>
            <AmountText amountCents={row.amount} currency={currency} style={styles.amount} />
          </View>
          <Animated.View
            style={[
              styles.bar,
              { width: `${Math.max((row.amount / max) * 100, 1)}%`, backgroundColor: row.color },
              { transform: [{ scaleX: grow }] },
            ]}
          />
        </View>
      ))}
      {pct !== null ? (
        <Text style={[styles.change, pct > 0 ? styles.up : pct < 0 ? styles.down : null]}>
          {changeText(pct, compare.previous_label)}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.lg },
  row: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  label: { ...typography.body, color: colors.textPrimary, flex: 1 },
  amount: { ...typography.body, color: colors.textPrimary },
  bar: { height: BAR_HEIGHT, borderRadius: radii.pill, transformOrigin: "left" },
  change: { ...typography.label, color: colors.textSecondary },
  // Spending up is the cautionary direction, down the reassuring one.
  up: { color: colors.peach },
  down: { color: colors.mint },
}));
