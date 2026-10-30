import { useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountText } from "@/components/ui/AmountText";
import { AnalyticsChartItem } from "@/features/analytics/types";
import { withAlpha } from "@/lib/color";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

interface ColumnBarsProps {
  items: AnalyticsChartItem[];
  currency: string;
}

const BAR_AREA_HEIGHT = 112;
// A zero day still shows a sliver, so seven bars always read as seven days.
const MIN_BAR_HEIGHT = 3;
// Longest label that fits under a column at this width without "…" — "T8/26".
const COLUMN_LABEL_MAX = 5;
const IDLE_BAR_ALPHA = 0.35;

// The backend names weekdays in full ("Thứ Hai"), which no column is wide
// enough for. The column says "T2"; the readout above still says "Thứ Hai".
const WEEKDAY_SHORT: Record<string, string> = {
  mon: "T2",
  tue: "T3",
  wed: "T4",
  thu: "T5",
  fri: "T6",
  sat: "T7",
  sun: "CN",
};

function columnLabel(item: AnalyticsChartItem): string {
  return WEEKDAY_SHORT[item.key] ?? item.label;
}

/** Whether every label fits under a column — otherwise draw rows (BarList). */
export function fitsColumns(items: AnalyticsChartItem[]): boolean {
  return items.every((item) => columnLabel(item).length <= COLUMN_LABEL_MAX);
}

function peakIndex(items: AnalyticsChartItem[]): number {
  return items.reduce((best, item, i) => (item.amount > items[best].amount ? i : best), 0);
}

// Vertical bars for the weekday pattern (Q13) and per-cycle totals (Q3).
//
// No figure above each column: seven compacted amounts in seven narrow
// columns were all cut to "~1m2…", which said nothing. Instead one readout
// line states the selected column in full — the peak by default — and
// tapping a column moves it there.
export function ColumnBars({ items, currency }: ColumnBarsProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [selected, setSelected] = useState(() => peakIndex(items));
  const [touched, setTouched] = useState(false);
  // Every bar rises from the baseline to its value on first render.
  const grow = useEntryAnimation();

  const max = Math.max(...items.map((i) => i.amount), 1);
  const current = items[selected] ?? items[0];

  const select = (i: number) => {
    setSelected(i);
    setTouched(true);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        <Text style={styles.readoutLabel}>{current.label}</Text>
        <AmountText amountCents={current.amount} currency={currency} style={styles.readoutAmount} />
      </View>

      <View style={styles.columns}>
        {items.map((item, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={item.key}
              onPress={() => select(i)}
              style={styles.column}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${formatCurrency(item.amount, currency)}`}
              accessibilityState={{ selected: active }}
            >
              <View style={styles.barArea}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(MIN_BAR_HEIGHT, (item.amount / max) * BAR_AREA_HEIGHT),
                      backgroundColor: active ? colors.periwinkle : withAlpha(colors.periwinkle, IDLE_BAR_ALPHA),
                    },
                    { transform: [{ scaleY: grow }] },
                  ]}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{columnLabel(item)}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Said once, until the first tap — after that it is known. */}
      {!touched ? <Text style={styles.hint}>{t("analytics.columns.hint")}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { gap: spacing.md },
  readout: { gap: 2 },
  readoutLabel: { ...typography.caption, color: colors.textSecondary },
  readoutAmount: { ...typography.title, color: colors.textPrimary },
  columns: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  column: { flex: 1, alignItems: "center", gap: spacing.sm },
  barArea: { height: BAR_AREA_HEIGHT, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  bar: { width: "64%", borderRadius: radii.pill, transformOrigin: "bottom" },
  label: { ...typography.caption, color: colors.textMuted },
  labelActive: { color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textMuted },
}));
