import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

const DIM_OPACITY = 0.5;
const DIM_MS = 160;
// A refinement answered this fast never dims at all: the dim would only blink.
const DIM_DELAY_MS = 150;

/**
 * Dims content that is being replaced — the previous filter's figures kept on
 * screen (keepPrevious) while the new ones load — instead of dropping it to a
 * skeleton. Says "updating" without the block changing shape. On the native
 * driver; spread the returned style onto an Animated.View.
 */
export function useDimWhile(active: boolean) {
  const opacity = useRef(new Animated.Value(active ? DIM_OPACITY : 1)).current;
  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: active ? DIM_OPACITY : 1,
      duration: DIM_MS,
      delay: active ? DIM_DELAY_MS : 0,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [active, opacity]);
  return useMemo(() => ({ opacity }), [opacity]);
}
