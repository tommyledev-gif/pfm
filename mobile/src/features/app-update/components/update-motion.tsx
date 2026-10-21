import { ReactNode, useEffect } from "react";
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/lib/use-reduce-motion";

const ENTER_MS = 320;
const RESIZE_MS = 240;
const SWAP_MS = 220;
const ENTER_RISE = 24;
const ENTER_SCALE = 0.94;
const SWAP_RISE = 8;
const EASE_OUT = Easing.out(Easing.cubic);

interface MotionProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The dialog card: rises and grows into place while the Modal fades the
 * backdrop in, so it arrives instead of blinking on.
 */
export function PopIn({ children, style, testID }: MotionProps) {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: ENTER_MS, easing: EASE_OUT });
  }, [t]);
  const motion = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * ENTER_RISE }, { scale: ENTER_SCALE + (1 - ENTER_SCALE) * t.value }],
  }));
  return (
    <Animated.View style={[style, !reduceMotion && motion]} testID={testID}>
      {children}
    </Animated.View>
  );
}

/**
 * Fades and lifts its content in on mount. Keyed by phase, each new phase
 * (progress, install, error) arrives this way instead of cutting in.
 */
export function FadeIn({ children, style }: MotionProps) {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: SWAP_MS, easing: EASE_OUT });
  }, [t]);
  const motion = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * SWAP_RISE }],
  }));
  return <Animated.View style={[style, !reduceMotion && motion]}>{children}</Animated.View>;
}

/**
 * Follows its content's height with a short glide, so the card grows and
 * shrinks between phases instead of jumping. Plain layout until the first
 * measure, so nothing ever starts at height 0. Not for keyboard-aware sheets
 * (see ExpandableLine): this dialog has no input.
 */
export function SmoothHeight({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const height = useSharedValue(-1);
  const motion = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    height.value =
      height.value < 0 || reduceMotion ? next : withTiming(next, { duration: RESIZE_MS, easing: EASE_OUT });
  };

  return (
    <Animated.View style={[{ overflow: "hidden" }, motion]}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}
