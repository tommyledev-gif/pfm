import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Keyboard, PanResponder, Vibration } from "react-native";

export type SwipeSide = "left" | "right";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Travel caps, as a fraction of screen width rather than of the row's own
// (variable) width, so the gesture feels identical on a short bubble and a
// long one.
//
// The two sides deliberately differ. A non-destructive side only ever has to
// show a small indicator, and 20% is the feel this app already had. A
// destructive side has to park open wide enough for a full-size labelled
// button, which does not fit in 20% of a phone.
export const EDIT_SWIPE_RATIO = 0.2;
export const DELETE_SWIPE_RATIO = 0.3;

// Share of the travel past which letting go parks the row open; below it the
// row snaps closed. The indicator fades in from the first pixel of the drag
// and is fully visible by here, where the "armed" tick also fires — so the
// User sees the action early and never has to drag the whole way.
export const PARK_THRESHOLD_RATIO = 0.5;
// Past the threshold, the indicator takes on its armed fill over this much
// more travel, so arming reads as a change rather than a blink.
export const ARMED_TRANSITION_SPAN = 0.15;
// Minimum horizontal travel before this row claims the gesture away from a
// parent list's vertical scroll and any inner Pressable. Small enough that
// the swipe still feels immediate, large enough that an ordinary scroll or
// button tap is never misread as a swipe.
const ACTIVATION_DISTANCE = 10;
// Two buzzes standing in for haptics (expo-haptics is not a dependency;
// Vibration is the one haptic-adjacent API react-native ships with): a light
// tick when the indicator arms, a longer one when the row parks.
const ARM_VIBRATION_MS = 10;
const PARK_VIBRATION_MS = 25;

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

export interface SwipeSideConfig {
  /** Fraction of screen width this side may travel before it parks. */
  ratio: number;
}

interface UseSwipeActionsOptions {
  /** Omit a side to disable dragging that way entirely. */
  left?: SwipeSideConfig;
  right?: SwipeSideConfig;
  disabled?: boolean;
}

export interface SwipeActionsState {
  translateX: Animated.Value;
  /** Per-side 0..1 travel fraction, for driving the indicator. */
  leftProgress: Animated.Value;
  rightProgress: Animated.Value;
  /** Which side is parked open, or null. Drives which button is rendered. */
  parkedSide: SwipeSide | null;
  close: () => void;
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"];
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
 * Plain PanResponder + Animated: react-native-gesture-handler and reanimated
 * are not dependencies of this project (mobile/package.json).
 */
export function useSwipeActions({ left, right, disabled }: UseSwipeActionsOptions): SwipeActionsState {
  const translateX = useRef(new Animated.Value(0)).current;
  // Kept apart from translateX because color interpolation exists only on the
  // JS driver, while the transform wants the native one — feeding one from the
  // other would mix drivers on a single animated node, which RN rejects.
  const leftProgress = useRef(new Animated.Value(0)).current;
  const rightProgress = useRef(new Animated.Value(0)).current;

  const [parkedSide, setParkedSide] = useState<SwipeSide | null>(null);

  const armedRef = useRef(false);
  const pastThresholdRef = useRef(false);
  const activeSideRef = useRef<SwipeSide | null>(null);
  // PanResponder zeroes gesture.dx on every grant, so a drag that continues
  // from an already-parked position must be measured from where the row is.
  const baseRef = useRef(0);
  const offsetRef = useRef(0);

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

    const reset = () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      Animated.timing(leftProgress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      Animated.timing(rightProgress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      armedRef.current = false;
      pastThresholdRef.current = false;
      activeSideRef.current = null;
      offsetRef.current = 0;
      baseRef.current = 0;
      setParkedSide(null);
    };

    const close = () => {
      if (closeCurrentlyParked === reset) closeCurrentlyParked = null;
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
      (side === "left" ? leftProgress : rightProgress).setValue(1);
      Animated.spring(translateX, { toValue: parkedAt, useNativeDriver: true, bounciness: 0 }).start();
      setParkedSide(side);
    };

    const release = () => {
      // Re-checked here and not only at grant time: a row that becomes
      // disabled mid-drag must release into nothing.
      if (!pastThresholdRef.current || disabledRef.current) {
        close();
        return;
      }
      park();
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
        baseRef.current = offsetRef.current;
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
        translateX.setValue(clamped);

        const side: SwipeSide | null = clamped > 0 ? "left" : clamped < 0 ? "right" : null;
        if (side) activeSideRef.current = side;

        const cap = side ? maxFor(side) : 0;
        const fraction = cap > 0 ? Math.abs(clamped) / cap : 0;
        leftProgress.setValue(side === "left" ? fraction : 0);
        rightProgress.setValue(side === "right" ? fraction : 0);

        if (fraction >= PARK_THRESHOLD_RATIO && !armedRef.current) {
          armedRef.current = true;
          Vibration.vibrate(ARM_VIBRATION_MS);
        } else if (fraction < PARK_THRESHOLD_RATIO && armedRef.current) {
          armedRef.current = false;
        }

        // No velocity shortcut: where the finger is on release decides,
        // which keeps the outcome predictable.
        pastThresholdRef.current = cap > 0 && fraction >= PARK_THRESHOLD_RATIO;
      },
      onPanResponderRelease: release,
      // A stolen gesture is not a deliberate release, so it never parks.
      onPanResponderTerminate: () => close(),
    });

    return { close, panHandlers: panResponder.panHandlers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A row that unmounts while parked must not leave the registry pointing at
  // a reset that can no longer run.
  useEffect(() => state.close, [state.close]);

  return {
    translateX,
    leftProgress,
    rightProgress,
    parkedSide,
    close: state.close,
    panHandlers: state.panHandlers,
  };
}

