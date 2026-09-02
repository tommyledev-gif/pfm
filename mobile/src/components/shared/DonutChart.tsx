import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
import { useHoldProgress } from "@/lib/use-hold-progress";
import { colors, typography } from "@/lib/theme";

export interface DonutSegment {
  key: string;
  label: string;
  amount: number;
  color: string;
  icon?: string | null;
  iconUrl?: string | null;
}

interface DonutChartProps {
  segments: DonutSegment[];
  currency: string;
  defaultLabel?: string;
  size?: number;
  selected: string | null;
  onToggle: (key: string) => void;
  // Sum of the user's current-month category budgets (in `currency`) — shown
  // as "spent / budget" in the center when nothing is selected. null/0 hides
  // the "/budget" half (e.g. a custom date range that doesn't correspond to
  // a monthly budget period — see SpendingTab's isDefaultRange).
  budgetTotal?: number | null;
}

const STROKE_WIDTH = 22;
const TOOLTIP_WIDTH = 130;
const TOOLTIP_HEIGHT = 48;

function polarToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Gentle continuous up/down float while a tooltip is shown, so it reads as a
// live callout rather than a static label — stops and resets the moment the
// selection is cleared or moves to a different segment.
function useFloat(active: boolean) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      translateY.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -4, duration: 700, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, translateY]);
  return translateY;
}

// Insights → Spending tab donut — README: "segments and legend rows are
// clickable: clicking a segment or its legend row highlights that segment
// (others fade to ~35% opacity) and swaps the center label to that
// category's name + $ amount; clicking the same one again deselects."
// Implemented as stacked <Circle> arcs via strokeDasharray/strokeDashoffset
// (react-native-svg has no native "pie" primitive) rather than copying the
// prototype's own runtime, per the design handoff's explicit instruction.
// Controlled by `selected`/`onToggle` so the chart and the legend list below
// it (DonutLegendRow) share one selection instead of drifting independently.
export function DonutChart({
  segments,
  currency,
  defaultLabel = "By Category",
  size = 200,
  selected,
  onToggle,
  budgetTotal = null,
}: DonutChartProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.amount, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const length = total > 0 ? (seg.amount / total) * circumference : 0;
    const arc = { ...seg, length, offset };
    offset += length;
    return arc;
  });

  const active = segments.find((s) => s.key === selected);
  const activeArc = arcs.find((a) => a.key === selected);
  const centerLabel = active ? active.label : defaultLabel;
  const centerAmount = active ? active.amount : total;

  const tooltipFloat = useFloat(Boolean(activeArc));

  let tooltipPos: { left: number; top: number } | null = null;
  if (activeArc) {
    const angleDeg = ((activeArc.offset + activeArc.length / 2) / circumference) * 360;
    const point = polarToPoint(size / 2, size / 2, radius + STROKE_WIDTH, angleDeg);
    tooltipPos = {
      left: Math.min(Math.max(point.x - TOOLTIP_WIDTH / 2, 0), size - TOOLTIP_WIDTH),
      top: Math.min(Math.max(point.y - TOOLTIP_HEIGHT / 2, 0), size - TOOLTIP_HEIGHT),
    };
  }

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {arcs.map((arc) => (
            <Circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={arc.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              fill="transparent"
              opacity={selected && selected !== arc.key ? 0.35 : 1}
              onPress={() => onToggle(arc.key)}
            />
          ))}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {/* <Text style={styles.centerLabel} numberOfLines={1}>
          {centerLabel}
        </Text> */}
        <Text style={styles.centerAmount} numberOfLines={1}>
          {formatCurrencyCompact(centerAmount, currency)}
        </Text>
        {!active && budgetTotal ? (
          <>
            <View style={styles.centerSeparator} />
            <Text style={styles.centerBudget} numberOfLines={1}>
              {formatCurrencyCompact(budgetTotal, currency)}
            </Text>
          </>
        ) : null}
      </View>
      {activeArc && tooltipPos ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.tooltip, { left: tooltipPos.left, top: tooltipPos.top, transform: [{ translateY: tooltipFloat }] }]}
        >
          <Text style={styles.tooltipTitle} numberOfLines={1}>
            {activeArc.label}
          </Text>
          <Text style={styles.tooltipValue}>
            {formatCurrency(activeArc.amount, currency)} · {total > 0 ? Math.round((activeArc.amount / total) * 100) : 0}%
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// Legend row is a separate component so it can live in a normal ScrollView
// list below the chart and still drive/reflect the same selection. Also
// doubles as a 2s-hold target (onHoldCategory) that opens a category picker
// drawer — the label eases toward the primary accent color while held so the
// user understands the row is holdable.
export function DonutLegendRow({
  segment,
  percentage,
  currency,
  selected,
  onPress,
  onHoldCategory,
}: {
  segment: DonutSegment;
  percentage: number;
  currency: string;
  selected: boolean;
  onPress: () => void;
  onHoldCategory?: (key: string) => void;
}) {
  const { progress, start, cancel } = useHoldProgress();
  const nameColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.textPrimary, colors.green] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={start}
      onPressOut={cancel}
      onLongPress={() => {
        cancel();
        onHoldCategory?.(segment.key);
      }}
      delayLongPress={2000}
      style={[legendStyles.row, selected && legendStyles.rowSelected]}
    >
      <View style={legendStyles.headRow}>
        <Avatar name={segment.label} color={segment.color} size={22} icon={segment.icon} iconUrl={segment.iconUrl} />
        <Animated.Text style={[legendStyles.name, { color: nameColor }]} numberOfLines={1}>
          {segment.label}
        </Animated.Text>
        <Text style={legendStyles.value}>
          {formatCurrency(segment.amount, currency)} · {percentage.toFixed(0)}%
        </Text>
      </View>
      <ProgressBar progress={percentage / 100} color={segment.color} height={4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", gap: 2, paddingHorizontal: 24 },
  centerLabel: { ...typography.caption, color: colors.textSecondary },
  centerAmount: { ...typography.cardTitle, color: colors.textPrimary },
  centerSeparator: { width: 28, height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 2 },
  centerBudget: { ...typography.caption, color: colors.textSecondary },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    minHeight: TOOLTIP_HEIGHT,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tooltipTitle: { ...typography.caption, color: colors.textPrimary },
  tooltipValue: { ...typography.tiny, color: colors.textSecondary },
});

const legendStyles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 8 },
  rowSelected: { opacity: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, ...typography.label },
  value: { ...typography.tiny, color: colors.textSecondary },
});
