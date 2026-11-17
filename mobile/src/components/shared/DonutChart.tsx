import { memo, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { entrance, exit } from "@/components/motion/motion-tokens";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
import { formatPercent } from "@/lib/percent";
import { ENTRY_DURATION_MS } from "@/lib/use-entry-animation";
import { typography, createStyles } from "@/lib/theme";
import { RingArc, layoutRing, polarToPoint } from "@/components/shared/donut-geometry";
import { markDonutTouch, registerDonutSelection } from "@/components/shared/donut-selection";

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
  size?: number;
  selected: string | null;
  onToggle: (key: string) => void;
  /** Shown under the total as "spent / budget" while nothing is selected. */
  budgetTotal?: number | null;
  /** Adds a "Xem giao dịch" link to the tooltip. */
  onPressDetails?: (key: string) => void;
}

const STROKE_WIDTH = 22;
const TOOLTIP_WIDTH = 130;
const TOOLTIP_HEIGHT = 48;
const TOOLTIP_HEIGHT_WITH_LINK = 74;
// Clearance between the ring and the tooltip.
const TOOLTIP_GAP = 10;
const DIMMED_OPACITY = 0.35;
const DIM_MS = 180;
const SWEEP_EASING = Easing.bezier(0.22, 1, 0.36, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface DonutArcProps {
  arc: RingArc<DonutSegment>;
  dimmed: boolean;
  sweep: SharedValue<number>;
  onToggle: (key: string) => void;
}

// Draws while the shared sweep crosses its own slice of the ring, on the UI
// thread, so a busy JS thread cannot stutter it.
const DonutArc = memo(function DonutArc({ arc, dimmed, sweep, onToggle }: DonutArcProps) {
  const { length, start, end } = arc;
  const opacity = useSharedValue(dimmed ? DIMMED_OPACITY : 1);

  useEffect(() => {
    opacity.value = withTiming(dimmed ? DIMMED_OPACITY : 1, { duration: DIM_MS });
  }, [dimmed, opacity]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [start, end], [length, 0], Extrapolation.CLAMP),
    opacity: opacity.value,
  }));

  return (
    <AnimatedPath
      d={arc.d}
      stroke={arc.segment.color}
      strokeWidth={STROKE_WIDTH}
      fill="none"
      strokeDasharray={`${length} ${length}`}
      animatedProps={animatedProps}
      onPress={() => onToggle(arc.segment.key)}
    />
  );
});

// Plays once, when there is something to draw.
function useSweep(ready: boolean) {
  const sweep = useSharedValue(0);
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    sweep.value = withTiming(1, { duration: ENTRY_DURATION_MS, easing: SWEEP_EASING });
  }, [ready, sweep]);
  return sweep;
}

/**
 * One arc per segment; tapping an arc (or its legend row) selects it and dims
 * the rest, tapping anywhere else in the chart clears it. Controlled through
 * `selected`/`onToggle` so the legend shares the same selection.
 *
 * A tap elsewhere on the screen clears it too (donut-selection.ts): the screen
 * owning the chart passes clearDonutSelectionOnOutsideTouch as its
 * onTouchStart, and the legend rows mark their own touches with markDonutTouch.
 */
export const DonutChart = memo(function DonutChart({
  segments,
  currency,
  size = 200,
  selected,
  onToggle,
  budgetTotal = null,
  onPressDetails,
}: DonutChartProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const tooltipHeight = onPressDetails ? TOOLTIP_HEIGHT_WITH_LINK : TOOLTIP_HEIGHT;

  const { radius, circumference, arcs } = useMemo(() => layoutRing(segments, size, STROKE_WIDTH), [segments, size]);
  const total = useMemo(() => segments.reduce((sum, s) => sum + s.amount, 0), [segments]);
  const sweep = useSweep(total > 0);

  const activeArc = arcs.find((a) => a.segment.key === selected);

  // While a slice is selected, a tap outside the chart and its legend clears it.
  useEffect(() => {
    if (selected === null) return;
    return registerDonutSelection(() => onToggle(selected));
  }, [selected, onToggle]);

  // The tooltip points at the middle of the tapped slice and sits on the side
  // of the ring that leaves that slice visible, inside the hollow centre.
  let tooltipPos: { left: number; top: number } | null = null;
  if (activeArc) {
    const angleDeg = ((activeArc.offset + activeArc.full / 2) / circumference) * 360;
    const point = polarToPoint(size / 2, size / 2, radius, angleDeg);
    const top =
      point.y < size / 2
        ? point.y + STROKE_WIDTH / 2 + TOOLTIP_GAP
        : point.y - STROKE_WIDTH / 2 - TOOLTIP_GAP - tooltipHeight;
    tooltipPos = {
      left: Math.min(Math.max(point.x - TOOLTIP_WIDTH / 2, 0), size - TOOLTIP_WIDTH),
      top: Math.min(Math.max(top, 0), size - tooltipHeight),
    };
  }

  const activeSegment = activeArc?.segment;

  return (
    <View style={styles.wrapper} onTouchStart={markDonutTouch}>
      {/* Under the Svg: a tap the arcs do not take clears the selection. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        disabled={!selected}
        onPress={() => selected && onToggle(selected)}
      />
      <Svg width={size} height={size}>
        {arcs.map((arc) =>
          arc.length > 0 ? (
            <DonutArc
              key={arc.segment.key}
              arc={arc}
              dimmed={selected !== null && selected !== arc.segment.key}
              sweep={sweep}
              onToggle={onToggle}
            />
          ) : null,
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.centerAmount} numberOfLines={1}>
          {formatCurrencyCompact(activeSegment ? activeSegment.amount : total, currency)}
        </Text>
        {!activeSegment && budgetTotal ? (
          <>
            <View style={styles.centerSeparator} />
            <Text style={styles.centerBudget} numberOfLines={1}>
              {formatCurrencyCompact(budgetTotal, currency)}
            </Text>
          </>
        ) : null}
      </View>
      {activeSegment && tooltipPos ? (
        <Animated.View
          key={activeSegment.key}
          entering={entrance("zoom")}
          exiting={exit("fade")}
          // box-none: taps still reach the arc underneath, the link takes its own.
          pointerEvents={onPressDetails ? "box-none" : "none"}
          style={[styles.tooltip, { minHeight: tooltipHeight, left: tooltipPos.left, top: tooltipPos.top }]}
        >
          <Text style={styles.tooltipTitle} numberOfLines={1}>
            {activeSegment.label}
          </Text>
          <Text style={styles.tooltipValue}>
            {formatCurrency(activeSegment.amount, currency)} ·{" "}
            {formatPercent(total > 0 ? (activeSegment.amount / total) * 100 : 0)}
          </Text>
          {onPressDetails ? (
            <Pressable onPress={() => onPressDetails(activeSegment.key)} hitSlop={8} testID="btn-donut-tooltip-details">
              <Text style={styles.tooltipLink}>{t("ui.donut.seeTransactions")}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  wrapper: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", gap: 2, paddingHorizontal: 24 },
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
}));
