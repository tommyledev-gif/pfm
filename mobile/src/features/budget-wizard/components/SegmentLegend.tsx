import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

export interface SegmentLegendEntry {
  key: string;
  name: string;
  color: string;
  /** xu. */
  amount: number;
  /** 0..1 share of the disposable total. */
  share: number;
}

interface SegmentLegendProps {
  entry: SegmentLegendEntry | null;
  currency: string;
}

/**
 * What the tapped block of the allocation bar actually is.
 *
 * ⚠️ Reserves its own height whether or not a block is selected. Appearing and
 * disappearing would shift every row beneath the bar on each tap, which turns
 * reading the chart into fighting the layout. Empty, it prompts.
 *
 * A one-line readout rather than a persistent legend listing every block: the
 * rows directly below the bar already name every category with its own colour
 * dot and amount, so a full legend would say the same thing twice. What was
 * missing was the link from a block to its row, and that is one line.
 */
export function SegmentLegend({ entry, currency }: SegmentLegendProps) {
  const styles = useStyles();
  if (!entry) {
    return (
      <View style={styles.row}>
        <Text style={styles.hint} numberOfLines={1}>
          Chạm từng khúc để xem tên mục.
        </Text>
      </View>
    );
  }

  return (
    <View testID="text-wizard-segment-legend" style={[styles.row, styles.rowActive]}>
      <View style={[styles.dot, { backgroundColor: entry.color }]} />
      <Text style={styles.name} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={styles.share}>{Math.round(entry.share * 100)}%</Text>
      <Text style={styles.amount} numberOfLines={1}>
        {formatCurrency(entry.amount, currency)}
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
  },
  rowActive: { backgroundColor: withAlpha(colors.overlayBase, 0.05) },
  hint: { ...typography.tiny, color: colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 2 },
  name: { flex: 1, ...typography.caption, color: colors.textPrimary },
  share: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
}));
