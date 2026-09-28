import { useEffect, useRef } from "react";
import { Animated, Easing, InteractionManager } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// Charts grow in over this long the first time they appear. Long enough to
// read as a gentle settle rather than a snap.
export const ENTRY_DURATION_MS = 900;

// Fast start, long soft landing (≈ easeOutQuint). A plain cubic ease-out spent
// most of its visible motion in the first few frames — exactly the frames a
// slow phone drops while the screen is still mounting — so it looked like a
// jump followed by a crawl.
const ENTRY_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * A 0 → 1 Animated.Value that plays once, the first time `ready` is true —
 * for charts that grow from zero to their real value on first render.
 *
 * `ready` exists because many charts mount before their data does: playing
 * the animation over an empty chart and then snapping to the real values
 * when the query lands would defeat the point.
 *
 * ⚠️ Smoothness on weak devices, deliberately:
 *  - It starts only after InteractionManager reports the JS thread idle. A
 *    screen's first frames are its busiest (every row mounting, queries
 *    resolving); an animation started then lost its opening frames to that
 *    work and stuttered.
 *  - Every caller drives transforms/opacity on the native driver, so once
 *    started the motion runs on the UI thread and cannot be blocked by JS.
 *    (The donut used to re-render itself every frame via setState; that is
 *    exactly the kind of work this hook now avoids.)
 *
 * Pass `useNativeDriver: false` only for a prop the native driver cannot
 * animate (an SVG dash offset).
 */
export function useEntryAnimation({
  ready = true,
  duration = ENTRY_DURATION_MS,
  useNativeDriver = true,
}: { ready?: boolean; duration?: number; useNativeDriver?: boolean } = {}): Animated.Value {
  const reduceMotion = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (reduceMotion) {
      value.setValue(1);
      return;
    }
    let animation: Animated.CompositeAnimation | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      animation = Animated.timing(value, { toValue: 1, duration, easing: ENTRY_EASING, useNativeDriver });
      animation.start();
    });
    return () => {
      task.cancel();
      animation?.stop();
      // Interrupted (unmount, or `ready` flipped back): land on the final
      // state rather than freezing a half-drawn chart.
      value.setValue(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return value;
}
