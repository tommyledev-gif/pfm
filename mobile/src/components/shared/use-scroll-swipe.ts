import { useEffect, useRef, useState } from "react";
import { Keyboard, Vibration } from "react-native";
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  ARM_VIBRATION_MS,
  CLOSE_SPRING,
  NUDGE_BACK_SPRING,
  NUDGE_DISTANCE,
  NUDGE_OUT_MS,
  PARK_THRESHOLD_RATIO,
  PARK_VIBRATION_MS,
  SwipeSide,
} from "@/components/shared/swipe-config";
import { registerParkedRow, unregisterParkedRow } from "@/components/shared/swipe-registry";
import { useLatestCallback } from "@/lib/use-latest-callback";

interface UseScrollSwipeOptions {
  /** Width of the strip revealed by dragging right; 0 for no left action. */
  leftWidth: number;
  /** Width of the strip revealed by dragging left; 0 for no right action. */
  rightWidth: number;
  disabled?: boolean;
}

const clamp01 = (value: number) => {
  "worklet";
  return Math.min(Math.max(value, 0), 1);
};

/**
 * SwipeableRow's gesture: the row is the middle page of a horizontal
 * ScrollView, [left strip][row][right strip], resting on the row. Dragging is
 * the platform's own scrolling, so the row is under the finger on every
 * frame and nothing but the finger moves it until the finger lets go.
 *
 * ⚠️ Native scrolling, not PanResponder (2026-10-26). A PanResponder's every
 * move went through the JS thread before the row could move: on a busy Home
 * (queries landing, the screen re-rendering) a slow drag reached JS ten times
 * in three seconds, so the row trailed the finger in jumps and shook. That
 * cannot be fixed from JS. A ScrollView also leaves "is this a row swipe or a
 * page scroll" to Android itself, with no round trip in which the page could
 * steal the touch.
 *
 * Releasing still only parks the row: snapToOffsets settles it on a strip or
 * home (a slow release on the nearest, a flick one step its way), and the
 * caller's button in the strip does the acting.
 */
export function useScrollSwipe({ leftWidth, rightWidth, disabled = false }: UseScrollSwipeOptions) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Scroll offset where the row sits in place: after the left strip.
  const rest = leftWidth;
  // How far the row is shifted from rest, + to the right: the old translateX.
  const shift = useSharedValue(0);
  const dragging = useSharedValue(false);
  // Peeks and closing drive the offset themselves, frame by frame. The
  // scroll events those writes echo back arrive a frame late and are ignored.
  const drive = useSharedValue(0);
  const driving = useSharedValue(false);
  const [parkedSide, setParkedSide] = useState<SwipeSide | null>(null);
  const parkedRef = useRef<SwipeSide | null>(null);
  parkedRef.current = parkedSide;

  const leftProgress = useDerivedValue(() => (leftWidth > 0 ? clamp01(shift.value / leftWidth) : 0));
  const rightProgress = useDerivedValue(() => (rightWidth > 0 ? clamp01(-shift.value / rightWidth) : 0));

  useAnimatedReaction(
    () => (driving.value ? drive.value : null),
    (x) => {
      if (x === null) return;
      shift.value = x;
      scrollTo(scrollRef, rest - x, 0, false);
    },
  );

  // A light tick the moment a release would park the row.
  useAnimatedReaction(
    () => dragging.value && Math.max(leftProgress.value, rightProgress.value) >= PARK_THRESHOLD_RATIO,
    (armed, wasArmed) => {
      if (armed && wasArmed === false) scheduleOnRN(Vibration.vibrate, ARM_VIBRATION_MS);
    },
  );

  // ⚠️ The drive's last frame lands here, not in the reaction above: the
  // completion runs before reactions do, and with `driving` already off the
  // final offset was never written. The row stopped a fraction of a pixel
  // short of home, and the strip behind showed as a hairline at its edge.
  const finishDrive = (finished: boolean | undefined) => {
    "worklet";
    if (!finished) return;
    shift.value = 0;
    scrollTo(scrollRef, rest, 0, false);
    driving.value = false;
  };

  // Home, unless a finger is on the row: then its release decides.
  const animateHome = () => {
    "worklet";
    if (dragging.value || (!driving.value && shift.value === 0)) return;
    drive.value = shift.value;
    driving.value = true;
    drive.value = withSpring(0, CLOSE_SPRING, finishDrive);
  };

  const close = useLatestCallback(() => {
    unregisterParkedRow(close);
    if (parkedRef.current !== null) setParkedSide(null);
    scheduleOnUI(animateHome);
  });

  const settled = useLatestCallback((offset: number) => {
    const side: SwipeSide | null = offset < rest - 1 ? "left" : offset > rest + 1 ? "right" : null;
    if (side === null || disabled) {
      if (side !== null) close();
      else unregisterParkedRow(close);
      return;
    }
    // Whatever else was parked gives way first: one open row on screen.
    registerParkedRow(close);
    if (parkedRef.current !== side) Vibration.vibrate(PARK_VIBRATION_MS);
    setParkedSide(side);
  });

  // Picking a parked row back up turns its button back into the indicator,
  // which fades with the travel as the row closes.
  const dragStarted = useLatestCallback(() => {
    Keyboard.dismiss();
    if (parkedRef.current !== null) setParkedSide(null);
  });

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      // A finger landing mid-peek or mid-close takes the row from where it is.
      cancelAnimation(drive);
      driving.value = false;
      dragging.value = true;
      scheduleOnRN(dragStarted);
    },
    onScroll: (event) => {
      if (driving.value) return;
      // Offsets are whole device pixels: a remainder under one is home.
      const next = rest - event.contentOffset.x;
      shift.value = Math.abs(next) < 0.5 ? 0 : next;
    },
    onEndDrag: () => {
      dragging.value = false;
    },
    onMomentumEnd: (event) => {
      if (driving.value) return;
      scheduleOnRN(settled, event.contentOffset.x);
    },
  });

  // A peek toward `side` and back, to show the row swipes.
  const nudge = useLatestCallback((side: SwipeSide) => {
    const width = side === "left" ? leftWidth : rightWidth;
    if (!width || parkedRef.current !== null) return;
    const distance = Math.min(NUDGE_DISTANCE, width * 0.4) * (side === "left" ? 1 : -1);
    scheduleOnUI(() => {
      "worklet";
      if (dragging.value || shift.value !== 0) return;
      drive.value = 0;
      driving.value = true;
      drive.value = withSequence(
        withTiming(distance, { duration: NUDGE_OUT_MS }),
        withSpring(0, NUDGE_BACK_SPRING, finishDrive),
      );
    });
  });

  // Switched off while open: it closes (a row becoming disabled mid-park).
  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  // A row unmounting while parked must not leave the registry pointing at it.
  useEffect(() => () => unregisterParkedRow(close), [close]);

  return { scrollRef, scrollHandler, rest, leftProgress, rightProgress, parkedSide, close, nudge };
}
