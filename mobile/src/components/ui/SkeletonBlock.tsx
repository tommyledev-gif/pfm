import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

import { useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const PULSE_CYCLE_MS = 1600;
const MIN_OPACITY = 0.4;
const MAX_OPACITY = 1;
const STATIC_OPACITY = 0.6;
// One eased breath per cycle (sin²), sampled so a single linear native timing
// can loop it. A looped sequence of two timings is restarted from JS every
// cycle, and a screen of skeletons hit the JS thread in a burst each time.
const PULSE_INPUT = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const PULSE_OUTPUT = [0, 0.146, 0.5, 0.854, 1, 0.854, 0.5, 0.146, 0].map(
  (t) => MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * t,
);

/** Pulsing placeholder; screens compose it into the shape of their content. */
export function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const phase = useRef(new Animated.Value(0)).current;
  const opacity = useMemo(() => phase.interpolate({ inputRange: PULSE_INPUT, outputRange: PULSE_OUTPUT }), [phase]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(phase, { toValue: 1, duration: PULSE_CYCLE_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, phase]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.surfaceBorder },
        { opacity: reduceMotion ? STATIC_OPACITY : opacity },
        style,
      ]}
    />
  );
}
