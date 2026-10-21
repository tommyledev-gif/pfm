import { useCallback } from "react";
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { PRESS_SCALE, PRESS_SPRING } from "@/components/motion/motion-tokens";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * PressableScale's dip as a hook, for a pressable that must keep control of
 * its own opacity. PressableScale's animated style always writes `opacity`
 * (it dims instead of scaling under Reduce Motion), which overrides any
 * opacity in the style it is given — a disabled button's 0.4 included. This
 * one only ever writes `transform`; under Reduce Motion it does nothing and
 * the caller keeps whatever static pressed look it had.
 *
 * Spread `onPressIn`/`onPressOut` onto an Animated Pressable and put `style`
 * last in its style array.
 */
export function usePressScale(scaleTo: number = PRESS_SCALE) {
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - (1 - scaleTo) * pressed.value }],
  }));

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, PRESS_SPRING);
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, PRESS_SPRING);
  }, [pressed]);

  return { style, onPressIn, onPressOut, reduceMotion };
}
