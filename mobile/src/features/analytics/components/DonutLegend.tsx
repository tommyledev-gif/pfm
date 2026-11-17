import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { DonutSegment } from "@/components/shared/DonutChart";
import { markDonutTouch } from "@/components/shared/donut-selection";
import { Avatar } from "@/components/ui/Avatar";
import { Collapsible } from "@/components/ui/Collapsible";
import { ChevronDownIcon } from "@/components/ui/Icon";
import { ANALYTICS_OTHER_KEY } from "@/features/analytics/constants";
import { formatCurrency } from "@/lib/currency";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface DonutLegendProps {
  segments: DonutSegment[];
  currency: string;
  /** Shared with the donut: a tapped row and a tapped slice are one selection. */
  selected: string | null;
  onToggle: (key: string) => void;
  defaultOpen: boolean;
}

const SWATCH_SIZE = 24;
// While one row is picked, the rest step back — the donut fades its other
// slices the same way.
const DIMMED_OPACITY = 0.45;

/**
 * The Categories behind a breakdown donut, folded under the chart: a slice
 * says which Category it is only once tapped, so this lists them all — the
 * slice's own colour (with the Category's icon), name, amount and share.
 *
 * The count in the button leaves out "Khác": that row is a fold of small
 * Categories, not a Category.
 */
export function DonutLegend({ segments, currency, selected, onToggle, defaultOpen }: DonutLegendProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(defaultOpen);
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  const count = segments.filter((s) => s.key !== ANALYTICS_OTHER_KEY).length;
  const toggleLabel = open ? t("analytics.legend.hide") : t("analytics.legend.show", { count });

  return (
    <View>
      <Pressable
        testID="btn-analytics-legend-toggle"
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        hitSlop={spacing.sm}
        style={styles.toggle}
      >
        <Text style={styles.toggleLabel}>{toggleLabel}</Text>
        <View style={open ? styles.chevronUp : null}>
          <ChevronDownIcon size={16} color={colors.textSecondary} />
        </View>
      </Pressable>

      <Collapsible open={open} testID="list-analytics-legend">
        {segments.map((segment) => {
          const share = formatPercent(total > 0 ? (segment.amount / total) * 100 : 0);
          const amount = formatCurrency(segment.amount, currency);
          const active = selected === segment.key;
          return (
            <Pressable
              key={segment.key}
              testID={`row-analytics-legend-${segment.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${segment.label}: ${amount}, ${share}`}
              accessibilityState={{ selected: active }}
              onTouchStart={markDonutTouch}
              onPress={() => onToggle(segment.key)}
              style={[styles.row, active && styles.rowActive, selected !== null && !active && styles.rowDimmed]}
            >
              {segment.key === ANALYTICS_OTHER_KEY ? (
                <View style={[styles.swatch, { backgroundColor: segment.color }]} />
              ) : (
                <Avatar name={segment.label} color={segment.color} size={SWATCH_SIZE} icon={segment.icon} iconUrl={segment.iconUrl} />
              )}
              <Text style={styles.name} numberOfLines={1}>
                {segment.label}
              </Text>
              <Text style={styles.amount}>{amount}</Text>
              <Text style={styles.share}>{share}</Text>
            </Pressable>
          );
        })}
      </Collapsible>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  toggleLabel: { ...typography.label, color: colors.textSecondary },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.listCard,
  },
  rowActive: { backgroundColor: colors.surfaceRaised },
  rowDimmed: { opacity: DIMMED_OPACITY },
  swatch: { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: SWATCH_SIZE / 2 },
  name: { ...typography.body, color: colors.textPrimary, flex: 1 },
  amount: { ...typography.label, color: colors.textPrimary },
  // Fixed width so the amounts line up whatever the share's digit count.
  share: { ...typography.caption, color: colors.textSecondary, minWidth: 36, textAlign: "right" },
}));
