import { ReactNode, useMemo, useRef } from "react";
import { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeInLeft, FadeInRight, FadeOut } from "react-native-reanimated";

// How far the incoming content starts off to the side. Small on purpose: it
// only has to say "this came from the right / left", and a card around it
// clips it.
const SLIDE_DISTANCE = 40;
const SLIDE_MS = 240;
// The outgoing content fades out as the incoming one arrives: long enough to
// cover the frame or two before the new content draws, short enough that the
// two are not read as one ghosted picture (150 ms was, on the emulator).
const LEAVE_MS = 90;

interface PeriodSlideProps {
  /** The active tab's position. A change remounts the children, entering from the side moved toward. */
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * Content that slides in from the side the User moved toward whenever `index`
 * (the active tab's position) changes: a tab to the right enters from the
 * right, one to the left from the left, fading up as it travels, while the
 * last tab's content fades out where it was. What shows at mount just shows.
 *
 * ⚠️ Reanimated entering/exiting animations on a remount, never an RN
 * Animated slide started from an effect. The new content has to be committed
 * invisible, and an effect only runs after React's whole layout phase, the
 * native animation a frame after that: on the emulator the new period sat
 * blank for 100 to 200 ms before it moved (2026-11-05), the card blinking out
 * on every switch. Layout animations start on the UI thread as the views
 * mount and unmount, and the old content fading out covers the frame or two
 * before the new one shows.
 *
 * Timed with an ease-out, not the app's spring: a spring starts from rest, so
 * the new content stayed nearly transparent for its first frames.
 */
export function PeriodSlide({ index, children, style, onLayout }: PeriodSlideProps) {
  const last = useRef(index);
  // 0 until the first switch.
  const direction = useRef(0);
  if (last.current !== index) {
    direction.current = index > last.current ? 1 : -1;
    last.current = index;
  }
  // New builders per switch: Reanimated's builders are mutable.
  const { entering, exiting } = useMemo(() => {
    if (direction.current === 0) return { entering: undefined, exiting: FadeOut.duration(LEAVE_MS) };
    const from = direction.current * SLIDE_DISTANCE;
    const preset = direction.current > 0 ? FadeInRight : FadeInLeft;
    return {
      entering: preset
        .withInitialValues({ opacity: 0, transform: [{ translateX: from }] })
        .duration(SLIDE_MS)
        .easing(Easing.out(Easing.cubic)),
      exiting: FadeOut.duration(LEAVE_MS),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  return (
    <Animated.View key={index} style={style} onLayout={onLayout} entering={entering} exiting={exiting}>
      {children}
    </Animated.View>
  );
}
