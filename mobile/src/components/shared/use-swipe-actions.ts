import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Keyboard, PanResponder, Vibration } from "react-native";
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  ACTIVATION_DISTANCE,
  ARM_VIBRATION_MS,
  CLOSE_SPRING,
  NUDGE_BACK_SPRING,
  NUDGE_DISTANCE,
  NUDGE_OUT_MS,
  PARK_SPRING,
  PARK_THRESHOLD_RATIO,
  PARK_VIBRATION_MS,
  STOLEN_SETTLE_MS,
  SwipeActionsState,
  SwipeSide,
  UseSwipeActionsOptions,
} from "@/components/shared/swipe-config";

const SCREEN_WIDTH = Dimensions.get("window").width;

export type { SwipeActionsState, SwipeSide, SwipeSideConfig } from "@/components/shared/swipe-config";
export {
  ARMED_TRANSITION_SPAN,
  DELETE_SWIPE_RATIO,
  EDIT_SWIPE_RATIO,
  PARK_THRESHOLD_RATIO,
} from "@/components/shared/swipe-config";

// Only one row anywhere may be parked at a time. Module-level rather than
// per-list, because the two surfaces that use this (the chat thread and
// Home's pending list) are never on screen together but share the rule, and
// a registry scoped per list would have to be threaded through context for
// no benefit.
let closeCurrentlyParked: (() => void) | null = null;

/** Closes whichever row is parked open, if any — for a list's scroll start. */
export function closeParkedSwipeRow() {
  const closeParked = closeCurrentlyParked;
  closeCurrentlyParked = null;
  closeParked?.();
}

/**
 * The park-and-confirm swipe gesture.
 *
 * ⚠️ It takes no action callback, and that is the point. Releasing past the
 * park threshold parks the row open and nothing else; the caller renders a
 * button in the revealed space and decides what tapping it does. Firing on release is what
 * made an accidental flick destroy a record, and no amount of confirmation
 * downstream fixes a gesture that has already acted.
 *
 * ⚠️ While the finger is down, only the finger moves the row (2026-10-24).
 * A close signal (the list changing or scrolling, a hold menu locking the
 * row) and a parent list taking the touch for a moment each used to spring
 * the row home or open mid-drag, and the next move put it back under the
 * finger: the row shook from side to side under a finger held half way.
 * Now nothing settles the row before the finger lets go.
 *
 * PanResponder for the touch (react-native-gesture-handler is not a
 * dependency), Reanimated for the motion: the row's position lives on the UI
 * thread, so a re-render never writes a stale one back, and a grab mid-spring
 * starts from where the row is, not from where it was headed.
 */
export function useSwipeActions({ left, right, disabled }: UseSwipeActionsOptions): SwipeActionsState {
  const translateX = useSharedValue(0);
  const leftMax = left ? SCREEN_WIDTH * left.ratio : 0;
  const rightMax = right ? SCREEN_WIDTH * right.ratio : 0;
  // Read off the row's own position, so they can never disagree with it.
  const leftProgress = useDerivedValue(() =>
    leftMax > 0 ? Math.min(Math.max(translateX.value / leftMax, 0), 1) : 0,
  );
  const rightProgress = useDerivedValue(() =>
    rightMax > 0 ? Math.min(Math.max(-translateX.value / rightMax, 0), 1) : 0,
  );

  const [parkedSide, setParkedSide] = useState<SwipeSide | null>(null);

  const armedRef = useRef(false);
  const pastThresholdRef = useRef(false);
  const activeSideRef = useRef<SwipeSide | null>(null);
  // PanResponder zeroes gesture.dx on every grant, so a drag that continues
  // from an already-parked position must be measured from where the row is.
  const baseRef = useRef(0);
  const offsetRef = useRef(0);
  // A finger is on the row.
  const draggingRef = useRef(false);
  const stolenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PanResponder.create runs once, so anything it reads has to come through a
  // ref or it freezes at its first-render value.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const leftRef = useRef(left);
  leftRef.current = left;
  const rightRef = useRef(right);
  rightRef.current = right;

  const state = useMemo(() => {
    const maxFor = (side: SwipeSide): number => {
      const config = side === "left" ? leftRef.current : rightRef.current;
      return config ? SCREEN_WIDTH * config.ratio : 0;
    };

    const clearStolenTimer = () => {
      if (stolenTimerRef.current === null) return;
      clearTimeout(stolenTimerRef.current);
      stolenTimerRef.current = null;
    };

    const reset = () => {
      translateX.value = withSpring(0, CLOSE_SPRING);
      armedRef.current = false;
      pastThresholdRef.current = false;
      activeSideRef.current = null;
      offsetRef.current = 0;
      baseRef.current = 0;
      setParkedSide(null);
    };

    const close = () => {
      if (closeCurrentlyParked === reset) closeCurrentlyParked = null;
      // Never from under a finger: the release settles the row.
      if (draggingRef.current) return;
      clearStolenTimer();
      // Already at rest: nothing to animate. Close signals reach every row
      // in a list, and only the parked one has work to do.
      if (offsetRef.current === 0 && activeSideRef.current === null) return;
      reset();
    };

    const park = () => {
      const side = activeSideRef.current;
      if (!side) {
        close();
        return;
      }
      // Whatever else was parked gives way first, so there is never more than
      // one armed destructive button on screen.
      if (closeCurrentlyParked && closeCurrentlyParked !== reset) closeCurrentlyParked();
      closeCurrentlyParked = reset;
      Vibration.vibrate(PARK_VIBRATION_MS);
      const parkedAt = side === "left" ? maxFor("left") : -maxFor("right");
      // Recorded as where the row now IS, not where the finger let go — the
      // next drag (e.g. swiping it closed) is measured from here.
      offsetRef.current = parkedAt;
      translateX.value = withSpring(parkedAt, PARK_SPRING);
      setParkedSide(side);
    };

    // Shows a row can be swiped without anyone having to guess: it slides a
    // little toward the side, letting that action's indicator show, then
    // settles back. A finger landing mid-peek takes over (grant stops it).
    const nudge = (side: SwipeSide) => {
      if (offsetRef.current !== 0 || activeSideRef.current !== null || draggingRef.current || !maxFor(side)) return;
      const distance = Math.min(NUDGE_DISTANCE, maxFor(side) * 0.4);
      translateX.value = withSequence(
        withTiming(side === "left" ? distance : -distance, { duration: NUDGE_OUT_MS }),
        withSpring(0, NUDGE_BACK_SPRING),
      );
    };

    // Where the finger left the row decides — no velocity shortcut, which
    // keeps the outcome predictable.
    const settle = () => {
      // Re-checked here and not only at grant time: a row that becomes
      // disabled mid-drag must release into nothing.
      if (!pastThresholdRef.current || disabledRef.current) {
        close();
        return;
      }
      park();
    };

    const release = () => {
      clearStolenTimer();
      draggingRef.current = false;
      settle();
    };

    // ⚠️ A parent list that takes the touch for a moment and hands it back
    // used to get a settle (home or open) each time, then the finger again:
    // the back-and-forth shake. The row stays where the finger left it and
    // settles only if the touch does not come back.
    const stolen = () => {
      draggingRef.current = false;
      clearStolenTimer();
      stolenTimerRef.current = setTimeout(() => {
        stolenTimerRef.current = null;
        settle();
      }, STOLEN_SETTLE_MS);
    };

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabledRef.current) return false;
        // A row standing open can always be dragged back toward closed, even
        // when the side it would cross into has no action of its own (a
        // User bubble offers only "Sửa"). Without this, a parked row could be
        // closed only by first dragging further open and reversing mid-hold.
        const offset = offsetRef.current;
        const draggingRight = gesture.dx > 0 && (Boolean(leftRef.current) || offset < 0);
        const draggingLeft = gesture.dx < 0 && (Boolean(rightRef.current) || offset > 0);
        return (
          (draggingRight || draggingLeft) &&
          Math.abs(gesture.dx) > ACTIVATION_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },
      // Never hand the gesture back. A parent ScrollView asks for it on every
      // pixel of vertical wander during a slow drag, and granting that was the
      // "row snaps home then jumps back under my finger" bug: each steal ran a
      // reset and each re-grant restarted from a freshly zeroed dx.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        clearStolenTimer();
        draggingRef.current = true;
        // ⚠️ Picked up from where the row IS. A running spring (the last
        // release settling, a peek) stops here; left running it kept writing
        // the row's position while the finger did too. And the drag goes on
        // from the spot it stopped at, not from where it was headed.
        cancelAnimation(translateX);
        const current = translateX.value;
        baseRef.current = current;
        offsetRef.current = current;
        // Picking a parked row back up turns its button back into the
        // drag indicator, so it fades with the travel as the row closes.
        // Releasing past the threshold parks it again.
        setParkedSide(null);
        // A swipe the User started must not be half-hidden behind the
        // keyboard. Safe mid-gesture: termination is refused above, so the
        // layout shift as the keyboard closes cannot steal this gesture.
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gesture) => {
        const total = baseRef.current + gesture.dx;
        const clamped = Math.max(-maxFor("right"), Math.min(maxFor("left"), total));
        offsetRef.current = clamped;
        translateX.value = clamped;

        const side: SwipeSide | null = clamped > 0 ? "left" : clamped < 0 ? "right" : null;
        if (side) activeSideRef.current = side;

        const cap = side ? maxFor(side) : 0;
        const fraction = cap > 0 ? Math.abs(clamped) / cap : 0;

        if (fraction >= PARK_THRESHOLD_RATIO && !armedRef.current) {
          armedRef.current = true;
          Vibration.vibrate(ARM_VIBRATION_MS);
        } else if (fraction < PARK_THRESHOLD_RATIO && armedRef.current) {
          armedRef.current = false;
        }

        pastThresholdRef.current = cap > 0 && fraction >= PARK_THRESHOLD_RATIO;
      },
      onPanResponderRelease: release,
      onPanResponderTerminate: stolen,
    });

    return { close, nudge, clearStolenTimer, panHandlers: panResponder.panHandlers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A row that unmounts while parked must not leave the registry pointing at
  // a reset that can no longer run, nor a settle timer running.
  useEffect(
    () => () => {
      state.clearStolenTimer();
      state.close();
    },
    [state],
  );

  return {
    translateX,
    nudge: state.nudge,
    leftProgress,
    rightProgress,
    parkedSide,
    close: state.close,
    panHandlers: state.panHandlers,
  };
}
