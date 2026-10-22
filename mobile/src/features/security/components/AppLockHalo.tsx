import { ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { useColors } from "@/lib/theme";

const RING_PERIOD_MS = 2400;
const RING_MAX_SCALE = 1.75;
const RING_COUNT = 2;

/**
 * Two soft pools of light behind the lock screen, the same treatment as the
 * budget wizard's WizardAmbientGlow: real radial falloff via react-native-svg,
 * low opacity, no full-screen wash.
 */
export function AppLockGlow() {
  const colors = useColors();
  const blobs = [
    { id: "lock-top", cx: "50%", cy: "38%", r: "62%", color: colors.green, opacity: 0.14 },
    { id: "lock-low", cx: "85%", cy: "92%", r: "55%", color: colors.periwinkle, opacity: 0.12 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {blobs.map((blob) => (
            <RadialGradient key={blob.id} id={blob.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.opacity} />
              <Stop offset="55%" stopColor={blob.color} stopOpacity={blob.opacity * 0.35} />
              <Stop offset="100%" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((blob) => (
          <Circle key={blob.id} cx={blob.cx} cy={blob.cy} r={blob.r} fill={`url(#${blob.id})`} />
        ))}
      </Svg>
    </View>
  );
}

interface HaloProps {
  size: number;
  /** Rings pulse while the owner check is up; otherwise they settle. */
  active: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}

/** The avatar's ripple: rings that grow out of it and fade, one after another. */
export function AppLockHalo({ size, active, reduceMotion, children }: HaloProps) {
  const first = useSharedValue(0);
  const second = useSharedValue(0);

  useEffect(() => {
    const rings = [first, second];
    if (!active || reduceMotion) {
      rings.forEach((ring) => {
        cancelAnimation(ring);
        ring.value = withTiming(0, { duration: 300 });
      });
      return;
    }
    rings.forEach((ring, index) => {
      ring.value = 0;
      ring.value = withDelay(
        (index * RING_PERIOD_MS) / RING_COUNT,
        withRepeat(withTiming(1, { duration: RING_PERIOD_MS, easing: Easing.out(Easing.quad) }), -1, false),
      );
    });
  }, [active, reduceMotion, first, second]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ring progress={first} size={size} />
      <Ring progress={second} size={size} />
      {children}
    </View>
  );
}

function Ring({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, RING_MAX_SCALE]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: size / 2, borderWidth: 1.5, borderColor: colors.green },
        style,
      ]}
    />
  );
}
