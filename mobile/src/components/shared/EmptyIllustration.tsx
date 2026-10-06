import { ReactNode, useEffect } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { withAlpha } from "@/lib/color";
import { createStyles, useColors } from "@/lib/theme";

const DEFAULT_SIZE = 128;
const FLOAT_DISTANCE = 6;
const FLOAT_MS = 2400;
const PULSE_MS = 2800;
const TWINKLE_MS = 1700;
const BADGE_DELAY_MS = 250;

interface EmptyIllustrationProps {
  /** The art at the centre — usually one icon, drawn inside a tinted tile. */
  children: ReactNode;
  /** A small round badge pinned to the tile's top-right corner (a +, an ×). */
  badge?: ReactNode;
  badgeColor?: string;
  /** false draws the art bare — for art that is its own shape, like a chart. */
  tile?: boolean;
  tint?: string;
  size?: number;
}

/**
 * The picture at the top of an empty state: a soft halo with a pulsing ring,
 * the art floating gently inside it, a badge that pops in, and two dots that
 * twinkle.
 *
 * Motion instead of a Lottie file — there is no Lottie dependency or asset in
 * this app, and an icon from the app's own set keeps every empty state in the
 * same visual language as the screen around it. Everything runs on the UI
 * thread (reanimated), and the loops stop while the screen is not focused —
 * tabs stay mounted behind each other here, and an animation nobody can see
 * is battery spent on nothing — and entirely for reduced-motion users.
 */
export function EmptyIllustration({
  children,
  badge,
  badgeColor,
  tile = true,
  tint: tintProp,
  size = DEFAULT_SIZE,
}: EmptyIllustrationProps) {
  const colors = useColors();
  const styles = useStyles();
  const tint = tintProp ?? colors.green;
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const animate = focused && !reduceMotion;

  const float = useSharedValue(0);
  const pulse = useSharedValue(0);
  const twinkle = useSharedValue(0);
  const badgeScale = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(float);
      cancelAnimation(pulse);
      cancelAnimation(twinkle);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    float.value = withRepeat(withTiming(1, { duration: FLOAT_MS, easing: ease }), -1, true);
    // Restarted from 0 so a resumed loop does not begin mid-ring.
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false);
    twinkle.value = withRepeat(withTiming(1, { duration: TWINKLE_MS, easing: ease }), -1, true);
  }, [animate, float, pulse, twinkle]);

  useEffect(() => {
    badgeScale.value = reduceMotion ? 1 : withDelay(BADGE_DELAY_MS, withSpring(1, { damping: 9, stiffness: 180 }));
  }, [reduceMotion, badgeScale]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -FLOAT_DISTANCE * float.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 0.8 + 0.45 * pulse.value }],
  }));
  const dotAStyle = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * twinkle.value }));
  const dotBStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.7 * twinkle.value }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  const tileSize = Math.round(size * 0.48);

  return (
    <View style={{ width: size, height: size }} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.halo,
          { borderRadius: size / 2, backgroundColor: withAlpha(tint, 0.06), borderColor: withAlpha(tint, 0.12) },
        ]}
      />
      <Animated.View
        style={[styles.halo, { borderRadius: size / 2, borderColor: withAlpha(tint, 0.35) }, pulseStyle]}
      />
      <Animated.View style={[styles.dot, styles.dotA, { backgroundColor: tint }, dotAStyle]} />
      <Animated.View style={[styles.dot, styles.dotB, { backgroundColor: tint }, dotBStyle]} />

      <View style={styles.center}>
        <Animated.View style={floatStyle}>
          {tile ? (
            <View
              style={[
                styles.tile,
                { width: tileSize, height: tileSize, borderColor: withAlpha(tint, 0.3), shadowColor: tint },
              ]}
            >
              {children}
            </View>
          ) : (
            children
          )}
          {badge ? (
            <Animated.View style={[styles.badge, { backgroundColor: badgeColor ?? tint }, badgeStyle]}>
              {badge}
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  halo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bgApp,
  },
  dot: { position: "absolute", borderRadius: 999 },
  dotA: { width: 7, height: 7, top: "14%", right: "12%" },
  dotB: { width: 5, height: 5, bottom: "18%", left: "10%" },
}));
