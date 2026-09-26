import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import { AnalyticsChartItem } from "@/features/analytics/types";
import { formatCurrencyCompact } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface LineChartProps {
  items: AnalyticsChartItem[];
  currency: string;
}

const HEIGHT = 96;
const PADDING = 6;
const DOT_RADIUS = 3;
const STROKE_WIDTH = 2;

// One Category over cycles (Q12) or spending per day (Q11). No axis: the
// first and last labels plus the peak are enough to read a trend inside a
// chat bubble, and anything more crowds it.
export function LineChart({ items, currency }: LineChartProps) {
  const [width, setWidth] = useState(0);

  const max = Math.max(...items.map((i) => i.amount), 1);
  const step = items.length > 1 ? (width - PADDING * 2) / (items.length - 1) : 0;
  const points = items.map((item, i) => ({
    x: PADDING + i * step,
    y: PADDING + (1 - item.amount / max) * (HEIGHT - PADDING * 2),
  }));
  const peak = items.reduce((best, item) => (item.amount > best.amount ? item : best), items[0]);

  const handleLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={handleLayout}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={colors.periwinkle}
            strokeWidth={STROKE_WIDTH}
          />
          {points.map((p, i) => (
            <Circle key={items[i].key} cx={p.x} cy={p.y} r={DOT_RADIUS} fill={colors.periwinkle} />
          ))}
        </Svg>
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.labels}>
        <Text style={styles.label}>{items[0]?.label}</Text>
        {peak ? (
          <Text style={styles.peak}>
            Cao nhất: {formatCurrencyCompact(peak.amount, currency)} ({peak.label})
          </Text>
        ) : null}
        <Text style={styles.label}>{items[items.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: spacing.xs },
  placeholder: { height: HEIGHT },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.tiny, color: colors.textMuted },
  peak: { ...typography.tiny, color: colors.textSecondary },
});
