import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
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
  // Turns the tooltip into a drill-down: when supplied, the callout grows a
  // tappable "Xem giao dịch" link under the amount that hands the segment key
  // back so the host can open its own transactions dialog for that category
  // over the same period the chart is drawn for.
  onPressDetails?: (key: string) => void;
}

const STROKE_WIDTH = 22;
const TOOLTIP_WIDTH = 130;
const TOOLTIP_HEIGHT = 48;
// The drill-down link adds a third line, and the tooltip's own placement math
// (flip above/below the arc, then clamp inside the chart box) needs the real
// height to keep the callout off the segment it describes.
const TOOLTIP_HEIGHT_WITH_LINK = 74;
// Clearance between the ring's inner edge and the tooltip, so the callout
// reads as pointing at the arc rather than touching it.
const TOOLTIP_GAP = 10;

function polarToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Gentle continuous float while a tooltip is shown, so it reads as a live
// callout rather than a static label — stops and resets the moment the
// selection is cleared or moves to a different segment.
//
// `direction` is +1 when the tooltip sits below its arc and -1 when above,
// so the drift always moves *away* from the segment. Floating the wrong way
// would nudge the callout back over the very arc it was just moved off.
function useFloat(active: boolean, direction: number) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      translateY.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: 4 * direction, duration: 700, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, direction, translateY]);
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
  onPressDetails,
}: DonutChartProps) {
  const tooltipHeight = onPressDetails ? TOOLTIP_HEIGHT_WITH_LINK : TOOLTIP_HEIGHT;
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

  // Tooltip placement. The anchor is the midpoint of the selected arc, taken
  // on the ring's centerline (`radius`) rather than outside it, then the
  // callout is flipped to whichever vertical side leaves that arc visible:
  // a segment in the donut's top half gets its tooltip *below* the ring, one
  // in the bottom half gets it *above*. Both land in the donut's empty
  // middle, clear of the center amount.
  //
  // It used to be centered on the anchor (`point.y - TOOLTIP_HEIGHT / 2`),
  // which meant the callout sat squarely on top of the one segment it was
  // describing — worst for the top of the chart, where clamping to the box
  // pinned it directly over the arc.
  let tooltipPos: { left: number; top: number } | null = null;
  let tooltipFloatDirection = -1;
  if (activeArc) {
    const angleDeg = ((activeArc.offset + activeArc.length / 2) / circumference) * 360;
    const point = polarToPoint(size / 2, size / 2, radius, angleDeg);
    const inUpperHalf = point.y < size / 2;
    tooltipFloatDirection = inUpperHalf ? 1 : -1;

    const top = inUpperHalf
      ? point.y + STROKE_WIDTH / 2 + TOOLTIP_GAP
      : point.y - STROKE_WIDTH / 2 - TOOLTIP_GAP - tooltipHeight;

    tooltipPos = {
      left: Math.min(Math.max(point.x - TOOLTIP_WIDTH / 2, 0), size - TOOLTIP_WIDTH),
      top: Math.min(Math.max(top, 0), size - tooltipHeight),
    };
  }

  const tooltipFloat = useFloat(Boolean(activeArc), tooltipFloatDirection);

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
        // box-none, not none: the callout itself must stay transparent to
        // touches so the arc underneath is still tappable, while the link
        // inside it receives its own.
        <Animated.View
          pointerEvents={onPressDetails ? "box-none" : "none"}
          style={[
            styles.tooltip,
            { minHeight: tooltipHeight, left: tooltipPos.left, top: tooltipPos.top, transform: [{ translateY: tooltipFloat }] },
          ]}
        >
          <Text style={styles.tooltipTitle} numberOfLines={1}>
            {activeArc.label}
          </Text>
          <Text style={styles.tooltipValue}>
            {formatCurrency(activeArc.amount, currency)} · {total > 0 ? Math.round((activeArc.amount / total) * 100) : 0}%
          </Text>
          {onPressDetails ? (
            <Pressable onPress={() => onPressDetails(activeArc.key)} hitSlop={8} testID="btn-donut-tooltip-details">
              <Text style={styles.tooltipLink}>Xem giao dịch</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
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
  tooltipLink: {
    ...typography.tiny,
    color: colors.green,
    textDecorationLine: "underline",
    textDecorationColor: colors.green,
    marginTop: 2,
  },
});
