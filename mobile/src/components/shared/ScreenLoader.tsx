import { useEffect } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 56;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// The arc breathes between these shares of the ring while the whole thing turns.
const ARC_MIN = 0.12;
const ARC_MAX = 0.62;
const SPIN_MS = 1100;
const BREATH_MS = 1300;
// A load faster than this never shows the loader at all.
const SHOW_AFTER_MS = 180;

interface ScreenLoaderProps {
  /** One short line under it, when the wait deserves a word. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The wait for a whole screen's content: a green arc sweeping round a faint
 * track, growing and shrinking as it turns, around a softly pulsing dot. For
 * the moment a screen has nothing to show yet — never for a row or a button,
 * which keep their own small spinners or skeletons.
 *
 * Fades in only after SHOW_AFTER_MS, so a quick load never flashes it. Under
 * Reduce Motion the arc holds still and only the dot breathes, slowly.
 */
export function ScreenLoader({ label, style }: ScreenLoaderProps) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: BREATH_MS * (reduceMotion ? 2 : 1), easing: Easing.inOut(Easing.quad) }), -1, true);
    if (!reduceMotion) spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breath);
    };
  }, [reduceMotion, spin, breath]);

  const arcProps = useAnimatedProps(() => {
    const share = reduceMotion ? 0.3 : ARC_MIN + (ARC_MAX - ARC_MIN) * breath.value;
    return { strokeDasharray: [CIRCUMFERENCE * share, CIRCUMFERENCE] };
  });
  // The breathing arc also drifts forward, so it never looks like it stalls
  // while it shrinks.
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360 + breath.value * 120}deg` }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * breath.value,
    transform: [{ scale: 0.75 + 0.25 * breath.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(220).delay(SHOW_AFTER_MS)}
      style={[styles.root, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Đang tải"}
      testID="screen-loader"
    >
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} style={styles.track}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={withAlpha(colors.overlayBase, 0.1)}
            strokeWidth={STROKE}
            fill="none"
          />
        </Svg>
        <Animated.View style={[styles.track, ringStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.green}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              animatedProps={arcProps}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.dot, dotStyle]} />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxl * 2 },
  ring: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  track: { position: "absolute", left: 0, top: 0 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lavender },
  label: { ...typography.caption, color: colors.textSecondary },
}));
