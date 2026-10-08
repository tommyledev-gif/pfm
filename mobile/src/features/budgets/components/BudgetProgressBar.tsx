import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { clampLevel, useLevelAnimation } from "@/lib/motion";
import { colors, createStyles } from "@/lib/theme";

interface BudgetProgressBarProps {
  // spent / limit. Values above 1 are expected — see OVER BUDGET below.
  ratio: number;
  // 0..1 share of the period elapsed, drawn as a vertical tick. Omitted on the
  // rows where a pace comparison is meaningless.
  pace?: number;
  color: string;
  height?: number;
}

// Width of the dark seam drawn where two coloured sections of the bar meet.
// Without it the two sections bleed into one ramp and the boundary — the one
// thing this bar exists to show — has to be inferred from a colour change.
const SEAM_WIDTH = 2;
// The over-budget colouring cross-fades in rather than snapping: it is a
// change of state, and a fade reads as one without adding any bounce.
const OVER_FADE_MS = 200;

// A budget bar, which the plain ProgressBar can't express: it shows how much
// is spent, where the period's pace marker sits (so "80% used" reads
// differently on the 5th than on the 25th), and how far past the limit an
// overspend went.
//
// OVER BUDGET: ⚠️ the bar is always FULL once spent passes the limit. It used
// to draw the in-budget part as a normal fill and only hatch the overspend
// tail, so at 385% three-quarters of the bar was a pale diagonal pattern and
// the solid part looked like "a quarter used" — the eye read the opposite of
// the number printed under it. Now the track is entirely filled: the first
// 1/ratio of it is the limit itself (soft coral), everything after the seam
// is the overspend (solid red). Scale is relative to what was spent, so the
// red share IS the overspent share. No pattern — solid colour carries it.
//
// MOTION: the fill follows the ratio with LEVEL_SPRING (one overshoot, then
// settle), grown in from the left on mount only. ⚠️ It is a full-width layer
// slid in with translateX behind a rounded clip, NOT a scaleX. A scaled fill
// rests at its scale, so its rounded end would stay squashed (a 4px radius is
// 0.4px wide at 10%) and the 2px seam would thin with it. Sliding keeps every
// child at its real size; the cost is one onLayout to learn the width, during
// which nothing is drawn — the intro starts from empty anyway. Over budget
// the fill goes to exactly full with no bounce (levelSpringFor's ceiling is
// the bar's end), and the limit/overspend colouring fades in over it.
// The pace tick is a fact about the calendar, not data that changed — it
// never animates.
export function BudgetProgressBar({ ratio, pace, color, height = 8 }: BudgetProgressBarProps) {
  const styles = useStyles();
  // NaN / undefined / negative → empty. +Infinity (spend against a 0 limit)
  // stays "over", with the whole bar as overspend.
  const safeRatio = typeof ratio === "number" && !Number.isNaN(ratio) ? Math.max(0, ratio) : 0;
  const over = safeRatio > 1;
  const fill = over ? 1 : clampLevel(safeRatio);
  // Where the limit falls along a full, overspent bar.
  const limitMark = over ? 1 / safeRatio : 1;
  // The split the over-budget layer last showed, kept while it fades back out
  // so the fade does not first snap to "all limit, no overspend".
  const shownLimitMark = useRef(limitMark);
  if (over) shownLimitMark.current = limitMark;
  const radius = height / 2;
  const [width, setWidth] = useState(0);

  const level = useLevelAnimation(fill, { initial: 0, floor: 0, ceiling: 1 });
  const overOpacity = useRef(new Animated.Value(over ? 1 : 0)).current;
  useEffect(() => {
    const fade = Animated.timing(overOpacity, { toValue: over ? 1 : 0, duration: OVER_FADE_MS, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [over, overOpacity]);

  // Clamped here only as a safety net — levelSpringFor already keeps the
  // overshoot inside 0..1, and past either end the layer would pull away from
  // the track's rounded edge.
  const translateX = useMemo(
    () => level.interpolate({ inputRange: [0, 1], outputRange: [-width, 0], extrapolate: "clamp" }),
    [level, width],
  );
  const fillOpacity = useMemo(() => Animated.subtract(1, overOpacity), [overOpacity]);

  // Pace is a share of the BUDGET, so once the bar's scale becomes "total
  // spent" the tick has to shrink into the budget's own section with it.
  const paceMark = pace === undefined ? undefined : clampLevel(pace) * limitMark;

  return (
    <View
      style={[styles.track, { height, borderRadius: radius }]}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        setWidth((prev) => (prev === next ? prev : next));
      }}
    >
      <View pointerEvents="none" style={[styles.clip, { borderRadius: radius }]}>
        {width > 0 ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
            <Animated.View
              style={[
                styles.segment,
                { left: 0, right: 0, backgroundColor: color, borderRadius: radius },
                { opacity: fillOpacity },
              ]}
            />
            {/* The spent | remaining seam, riding the fill's right edge. Only
                while the bar is partly full — at 0% or 100% a floating dark
                tick reads as a defect. */}
            {!over && fill > 0 && fill < 1 ? <View style={[styles.seam, { right: 0 }]} /> : null}

            {/* The budget's own share drawn soft, the overspend after it
                solid — so the loud part is the part that's wrong. */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: overOpacity }]}>
              <View
                style={[
                  styles.segment,
                  { left: 0, width: `${shownLimitMark.current * 100}%`, backgroundColor: withAlpha(colors.peach, 0.45) },
                ]}
              />
              <View
                style={[
                  styles.segment,
                  { left: `${shownLimitMark.current * 100}%`, right: 0, backgroundColor: colors.danger },
                ]}
              />
              <View style={[styles.seam, { left: `${shownLimitMark.current * 100}%`, marginLeft: -SEAM_WIDTH / 2 }]} />
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>

      {paceMark !== undefined ? (
        <View pointerEvents="none" style={[styles.pace, { left: `${paceMark * 100}%`, height: height + 6, top: -3 }]} />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: { width: "100%", backgroundColor: colors.trackMuted, overflow: "visible", justifyContent: "center" },
  // Clips the sliding fill to the bar's rounded shape — the pace tick stays
  // outside it so it can sit proud of the bar.
  clip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  segment: { position: "absolute", top: 0, bottom: 0 },
  // Painted in the app background rather than left transparent: the track
  // underneath is a translucent white, so a hole would show the track, not a
  // gap. This has to be an opaque cut.
  seam: { position: "absolute", top: 0, bottom: 0, width: SEAM_WIDTH, backgroundColor: colors.bgApp },
  // Sits proud of the bar on both edges so it stays legible over a filled
  // section as well as over the empty track.
  pace: { position: "absolute", width: 2, backgroundColor: colors.textSecondary, borderRadius: 1 },
}));
