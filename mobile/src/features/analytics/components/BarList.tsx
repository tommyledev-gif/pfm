import { Animated, Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { ANALYTICS_OTHER_KEY } from "@/features/analytics/constants";
import { AnalyticsChartItem } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

interface BarListProps {
  items: AnalyticsChartItem[];
  currency: string;
}

const BAR_HEIGHT = 6;

// Horizontal bars for totals whose labels are names, not dates — per-Wallet
// spending (Q8). Each row gets the full width for its label and its exact
// amount, so nothing has to be cut to fit; the bar under it is scaled to the
// largest row.
export function BarList({ items, currency }: BarListProps) {
  const styles = useStyles();
  const grow = useEntryAnimation();
  const max = Math.max(...items.map((i) => i.amount), 1);

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.head}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <AmountText amountCents={item.amount} currency={currency} style={styles.amount} />
          </View>
          <Animated.View
            style={[
              styles.bar,
              { width: `${Math.max((item.amount / max) * 100, 1)}%` },
              item.key === ANALYTICS_OTHER_KEY ? styles.barOther : null,
              { transform: [{ scaleX: grow }] },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.lg },
  row: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  label: { ...typography.body, color: colors.textPrimary, flex: 1 },
  amount: { ...typography.body, color: colors.textPrimary },
  bar: { height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: colors.periwinkle, transformOrigin: "left" },
  barOther: { backgroundColor: colors.trackMuted },
}));
