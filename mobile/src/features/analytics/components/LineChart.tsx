import { useState } from "react";
import { Animated, LayoutChangeEvent, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Polyline } from "react-native-svg";

import { AnalyticsChartItem } from "@/features/analytics/types";
import { formatCurrencyCompact } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

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
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  // First render: the line draws itself left to right. A clip window slides
  // in from the left while its content slides the opposite way by the same
  // amount, so the chart itself stays put and only the visible part grows.
  // Two translations instead of an animated width, so it runs on the native
  // driver — an animated width re-laid-out the chart on the JS thread every
  // frame, which is what stuttered on slower phones.
  const reveal = useEntryAnimation({ ready: width > 0 });
  const clipShift = reveal.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const contentShift = reveal.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

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
        <Animated.View style={[styles.clip, { width, transform: [{ translateX: clipShift }] }]}>
          <Animated.View style={{ transform: [{ translateX: contentShift }] }}>
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
          </Animated.View>
        </Animated.View>
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.labels}>
        <Text style={styles.label}>{items[0]?.label}</Text>
        {peak ? (
          <Text style={styles.peak}>
            {t("analytics.line.peak", { amount: formatCurrencyCompact(peak.amount, currency), label: peak.label })}
          </Text>
        ) : null}
        <Text style={styles.label}>{items[items.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrap: { width: "100%", gap: spacing.xs },
  placeholder: { height: HEIGHT },
  clip: { height: HEIGHT, overflow: "hidden" },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.tiny, color: colors.textMuted },
  peak: { ...typography.tiny, color: colors.textSecondary },
}));
