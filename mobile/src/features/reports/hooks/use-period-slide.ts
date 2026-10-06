import { useLayoutEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

// How far the incoming period's content starts off to the side. Small on
// purpose: it only has to say "this came from the right / left", and the
// card it sits in clips it.
const SLIDE_DISTANCE = 40;
const SLIDE_DURATION = 240;

/**
 * Slides content in from the side the User moved toward whenever `index` —
 * the active period tab's position — changes: a tab to the right enters from
 * the right, one to the left from the left, fading up as it travels. The
 * first render does not animate.
 *
 * Only transform and opacity move, on the native driver, so the content's
 * layout (and everything measured from it, like the snapshot ring) is
 * exactly what an instant swap would have produced.
 */
export function usePeriodSlide(index: number) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previous = useRef(index);

  // A layout effect, so the start position is set before the new period's
  // content is first painted rather than one frame after it, in place.
  useLayoutEffect(() => {
    if (previous.current === index) return;
    const direction = index > previous.current ? 1 : -1;
    previous.current = index;
    // setValue also stops a slide still running from a quick double switch.
    translateX.setValue(direction * SLIDE_DISTANCE);
    opacity.setValue(0);
    const easing = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: SLIDE_DURATION, easing, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: SLIDE_DURATION, easing, useNativeDriver: true }),
    ]).start();
  }, [index, translateX, opacity]);

  return { opacity, transform: [{ translateX }] };
}
