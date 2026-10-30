import { useEffect } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

const TRACK_HEIGHT = 8;
// A fill step per whole percent would tick; easing between them reads as one movement.
const FILL_MS = 260;
// Before the size is known: a segment this share of the track sweeps across it.
const SWEEP_SHARE = 0.32;
const SWEEP_MS = 1100;

interface UpdateProgressProps {
  /** 0..1; null until the server has said how big the file is. */
  progress: number | null;
}

/**
 * The APK download, as a status panel rather than a button: a label, the
 * percent once it is known, and a bar that never stands still. Before the
 * first byte arrives the size is unknown, so the bar sweeps instead of
 * sitting empty, which looked stuck.
 */
export function UpdateProgress({ progress }: UpdateProgressProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <View
      style={styles.panel}
      accessibilityRole="progressbar"
      accessibilityLabel={t("appUpdate.progress")}
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }}
      testID="progress-native-update"
    >
      <View style={styles.row}>
        <Text style={styles.label}>{t("appUpdate.progress")}</Text>
        {progress === null ? null : <Text style={styles.percent}>{formatPercent(progress * 100)}</Text>}
      </View>
      <View style={styles.track}>{progress === null ? <SweepBar /> : <FillBar fraction={progress} />}</View>
    </View>
  );
}

function FillBar({ fraction }: { fraction: number }) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = reduceMotion ? fraction : withTiming(fraction, { duration: FILL_MS, easing: Easing.out(Easing.quad) });
  }, [fraction, reduceMotion, value]);
  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return <Animated.View style={[styles.fill, fill]} />;
}

function SweepBar() {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const trackWidth = useSharedValue(0);
  const t = useSharedValue(0);

  useEffect(() => {
    // Reduced motion: the segment rests at the start of the track.
    if (reduceMotion) t.value = SWEEP_SHARE / (1 + SWEEP_SHARE);
    else t.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  // From just off the left edge to just off the right one.
  const sweep = useAnimatedStyle(() => {
    const segment = trackWidth.value * SWEEP_SHARE;
    return { width: segment, transform: [{ translateX: -segment + t.value * (trackWidth.value + segment) }] };
  });

  return (
    <View style={styles.sweepBox} onLayout={(e) => (trackWidth.value = e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fill, sweep]} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  panel: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.listCard,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  label: { ...typography.body, color: colors.textPrimary },
  // Same-width digits: the number ticking up does not shift sideways.
  percent: { ...typography.body, fontWeight: "800", color: colors.green, fontVariant: ["tabular-nums"] },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.green, 0.18),
    overflow: "hidden",
  },
  sweepBox: { flex: 1 },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.green },
}));
