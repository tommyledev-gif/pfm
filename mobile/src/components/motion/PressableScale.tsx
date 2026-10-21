import { ReactNode } from "react";
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { PRESS_SCALE, PRESS_SPRING } from "@/components/motion/motion-tokens";
import { useReduceMotion } from "@/lib/use-reduce-motion";

interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  children?: ReactNode;
  /** Applied to the scaling box, so layout (flex, margins) belongs here. */
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held. */
  scaleTo?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that dips slightly while held and springs back on release —
 * animate-ui's "press" feel, on the UI thread. Reduce Motion: no scale; the
 * press still dims a little so it is not left without feedback.
 */
export function PressableScale({
  children,
  style,
  scaleTo = PRESS_SCALE,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);

  // Opacity only under Reduce Motion: written always, it would override a
  // caller's own (a disabled button's dimming) with 1.
  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - 0.3 * pressed.value }
      : { transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }] },
  );

  const handleIn = (e: GestureResponderEvent) => {
    pressed.value = withSpring(1, PRESS_SPRING);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    pressed.value = withSpring(0, PRESS_SPRING);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
