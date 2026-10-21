import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CloudArrowUpIcon } from "phosphor-react-native/src/icons/CloudArrowUp";

import { PRESS_SPRING, entrance, exit } from "@/components/motion/motion-tokens";
import { withAlpha } from "@/lib/color";
import { radii, createStyles, useColors } from "@/lib/theme";
import type { UploadPhase } from "@/lib/use-upload-progress";
import { useReduceMotion } from "@/lib/use-reduce-motion";

export const WELL_SIZE = 40;
const GLYPH_SIZE = 20;
// While the upload runs, the cloud rises and settles, as if lifting the file.
const BOB_DISTANCE = 3;
const BOB_MS = 520;
const SETTLE_MS = 150;
const BAR_HEIGHT = 4;

// Lands with the press spring's slight overshoot: a pop, not a fade. Built
// fresh per call, like motion-tokens' presets (the builders are mutable).
export const popIn = () =>
  ZoomIn.withInitialValues({ transform: [{ scale: 0.4 }] })
    .springify()
    .damping(PRESS_SPRING.damping)
    .stiffness(PRESS_SPRING.stiffness)
    .mass(PRESS_SPRING.mass);

/**
 * The upload card's tinted circle: a cloud with an arrow, lifting gently while
 * the upload runs, and a solid green disc with a check popping over it once
 * the server has the file. Reduce motion: the cloud stays still, and the disc
 * appears without the pop (Reanimated's layout animations follow the setting).
 */
export function UploadWell({ phase }: { phase: UploadPhase }) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const bob = useSharedValue(0);
  const running = phase === "progress" || phase === "waiting";

  useEffect(() => {
    if (!running || reduceMotion) {
      bob.value = reduceMotion ? 0 : withTiming(0, { duration: SETTLE_MS });
      return;
    }
    bob.value = withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(bob);
  }, [running, reduceMotion, bob]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -BOB_DISTANCE * bob.value }] }));

  return (
    <View style={styles.well} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={bobStyle}>
        <CloudArrowUpIcon size={GLYPH_SIZE} color={colors.green} weight="bold" />
      </Animated.View>
      {phase === "done" ? (
        <Animated.View entering={popIn()} exiting={exit("fade")} style={styles.doneDisc}>
          <CheckIcon size={GLYPH_SIZE} color={colors.onGreen} weight="bold" />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A thin bar filling left to right from the upload's 0–1 progress, on the UI thread. */
export function UploadProgressBar({ progress }: { progress: SharedValue<number> }) {
  const styles = useStyles();
  const fill = useAnimatedStyle(() => ({ width: `${Math.min(Math.max(progress.value, 0), 1) * 100}%` }));
  return (
    <Animated.View entering={entrance("fade")} style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  well: {
    width: WELL_SIZE,
    height: WELL_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.14),
  },
  doneDisc: {
    position: "absolute",
    left: 0,
    top: 0,
    width: WELL_SIZE,
    height: WELL_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.green, 0.18),
  },
  fill: { height: "100%", borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.green },
}));
