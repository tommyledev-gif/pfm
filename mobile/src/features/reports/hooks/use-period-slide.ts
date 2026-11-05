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
 *
 * ⚠️ The start position is set while rendering, not in an effect. The new
 * period's content is committed with this view's props as they stand when it
 * renders; set from a layout effect, the start values went to the native side
 * separately and could land a frame after the new content was drawn — the new
 * figures showed at full opacity in place, then vanished to the side and slid
 * back: a flash and a shake on every switch.
 */
export function usePeriodSlide(index: number) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // The index the start position was last set for, and the last one a slide
  // was started for. Kept apart so a render React throws away (it set the
  // start position, but its effect never ran) still gets its slide at the
  // next commit instead of leaving the content invisible.
  const armed = useRef(index);
  const slid = useRef(index);

  if (armed.current !== index) {
    // setValue also stops a slide still running from a quick double switch.
    translateX.setValue((index > armed.current ? 1 : -1) * SLIDE_DISTANCE);
    opacity.setValue(0);
    armed.current = index;
  }

  useLayoutEffect(() => {
    if (slid.current === index) return;
    slid.current = index;
    const easing = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: SLIDE_DURATION, easing, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: SLIDE_DURATION, easing, useNativeDriver: true }),
    ]).start();
  }, [index, translateX, opacity]);

  return { opacity, transform: [{ translateX }] };
}
