import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleProp, ViewStyle } from "react-native";

import { useColors } from "@/lib/theme";

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const PULSE_DURATION_MS = 800;
const MIN_OPACITY = 0.4;
const MAX_OPACITY = 1;
const STATIC_OPACITY = 0.6;

// Shared pulsing placeholder primitive (specs/mobile-loading-skeletons/spec.md
// decision #2) — every screen composes this into a layout shaped like its
// eventual content. One Animated.Value per instance (plan.md Pre-flight
// Finding #3), not shared/hoisted, so unmounting one skeleton never
// disrupts another's animation loop.
export function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: MAX_OPACITY, duration: PULSE_DURATION_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: MIN_OPACITY, duration: PULSE_DURATION_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.stopAnimation();
    };
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.surfaceBorder },
        reduceMotion ? { opacity: STATIC_OPACITY } : { opacity },
        style,
      ]}
    />
  );
}
