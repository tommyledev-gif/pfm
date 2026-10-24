import { useEffect, useRef } from "react";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BOB_DISTANCE, BOB_DURATION, ICON_BOUNCE_SCALE } from "@/components/shared/bottom-nav-styles";

// The springs the ball had on RN Animated (Origami tension/friction 210/14,
// 180/10 and 220/7), as the stiffness/damping they converted to: same feel.
const SLIDE_SPRING = { stiffness: 846, damping: 43, mass: 1 };
const SQUISH_SPRING = { stiffness: 737, damping: 31, mass: 1 };
const POP_SPRING = { stiffness: 882, damping: 22, mass: 1 };
// The ball's squash at the start of a switch: wider and flatter.
const SQUISH_X = 0.22;
const SQUISH_Y = 0.15;

/** The idle float at `phase` (0..1 per breath): 0 seated → 1 raised → 0. */
export function bobAt(phase: number): number {
  "worklet";
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/**
 * Every animated value of the BottomNav's ball, the styles built on them, and
 * the three moves made with them: place (first layout, no motion), reveal
 * (fade in once placed), and switchTo (a tab change). Split out of BottomNav
 * for the 300-line cap.
 *
 * ⚠️ Reanimated, not RN Animated (2026-10-24). On the native driver, every
 * render of the nav during a tab switch (the held tab, the new pathname, the
 * commits of the screen mounting under it) sent the JS side's stale values
 * back to the views: the ball's old position, a seated float, the icon
 * opacities from before the tap. The native animation pulled them back on
 * the next frame, so the ball shook back and forth and up and down and its
 * icon flashed until the new screen settled, about two seconds. Shared values
 * live on the UI thread, where a React commit cannot overwrite them, and a
 * switch starts there the moment it is assigned.
 *
 * The icons fade themselves (NavIconFade) from `activeIcon`.
 */
export function useNavBallMotion(startIndex: number) {
  // ⚠️ Hidden until placed: at x 0 the ball would sit under the first tab
  // for a frame before the row is measured.
  const ballOpacity = useSharedValue(0);
  const ballX = useSharedValue(0);
  const squish = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const bobPhase = useSharedValue(0);
  const activeIcon = useSharedValue(startIndex);
  // What the icons start from, before any switch.
  const initialIcon = useRef(startIndex).current;

  // Idle float, forever: it drives translateY only, while ballX and squish
  // own translateX and scale, so a switch mid-float leaves it alone.
  useEffect(() => {
    bobPhase.value = withRepeat(withTiming(1, { duration: BOB_DURATION * 2, easing: Easing.linear }), -1);
    return () => cancelAnimation(bobPhase);
  }, [bobPhase]);

  const followBall = useAnimatedStyle(() => ({ transform: [{ translateX: ballX.value }] }));
  // The hairline and the hollow's rim: with the ball, and hidden until it is placed.
  const revealFollow = useAnimatedStyle(() => ({
    opacity: ballOpacity.value,
    transform: [{ translateX: ballX.value }],
  }));
  const bandCover = useAnimatedStyle(() => ({ opacity: 1 - ballOpacity.value }));
  const ballStyle = useAnimatedStyle(() => ({
    opacity: ballOpacity.value,
    transform: [
      { translateX: ballX.value },
      { translateY: -BOB_DISTANCE * bobAt(bobPhase.value) },
      { scaleX: 1 + SQUISH_X * squish.value },
      { scaleY: 1 - SQUISH_Y * squish.value },
    ],
  }));
  const iconPop = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  const place = (index: number, x: number) => {
    ballX.value = x;
    activeIcon.value = index;
  };

  const reveal = () => {
    ballOpacity.value = withTiming(1, { duration: 120 });
  };

  /** Ball to `x`, icons to tab `index`. */
  const switchTo = (index: number, x: number) => {
    ballX.value = withSpring(x, SLIDE_SPRING);
    squish.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 90 }),
      withSpring(0, SQUISH_SPRING),
    );
    activeIcon.value = index;
    // The new icon arrives with a small pop (1 → 1.15 → 1) so the switch
    // registers as a response to the tap, not just a swap.
    iconScale.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(60, withTiming(ICON_BOUNCE_SCALE, { duration: 120, easing: Easing.out(Easing.quad) })),
      withSpring(1, POP_SPRING),
    );
  };

  return {
    ballOpacity,
    ballX,
    bobPhase,
    activeIcon,
    initialIcon,
    followBall,
    revealFollow,
    bandCover,
    ballStyle,
    iconPop,
    place,
    reveal,
    switchTo,
  };
}
