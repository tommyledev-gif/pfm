import { useCallback } from "react";
import { interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

// The tint waits this long before moving, so a scroll that merely starts on
// a row never flickers its label.
const TINT_DELAY_MS = 150;
const RELEASE_MS = 150;

/**
 * For a row with a long hold (Spending's legend, budget rows): its label eases
 * from `idleColor` to `holdColor` over the hold, so the gesture shows it is
 * registering. Runs on the UI thread; apply `tintStyle` to a Reanimated text.
 */
export function useHoldProgress(idleColor: string, holdColor: string, durationMs = 2000) {
  const progress = useSharedValue(0);

  const start = useCallback(() => {
    progress.value = withDelay(TINT_DELAY_MS, withTiming(1, { duration: Math.max(durationMs - TINT_DELAY_MS, 0) }));
  }, [durationMs, progress]);

  const cancel = useCallback(() => {
    progress.value = withTiming(0, { duration: RELEASE_MS });
  }, [progress]);

  const tintStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [idleColor, holdColor]),
  }));

  return { start, cancel, tintStyle };
}
