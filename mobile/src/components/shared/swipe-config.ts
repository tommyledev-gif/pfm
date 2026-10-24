import type { GestureResponderEvent, PanResponder } from "react-native";
import type { DerivedValue, SharedValue } from "react-native-reanimated";

// The swipe rows' tuning and types (use-swipe-actions), split out for the
// 300-line cap.

export type SwipeSide = "left" | "right";

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
export const ACTIVATION_DISTANCE = 10;
// Two buzzes standing in for haptics (expo-haptics is not a dependency;
// Vibration is the one haptic-adjacent API react-native ships with): a light
// tick when the indicator arms, a longer one when the row parks.
export const ARM_VIBRATION_MS = 10;
export const PARK_VIBRATION_MS = 25;
// The peek that shows a row can be swiped (nudge).
export const NUDGE_DISTANCE = 36;
export const NUDGE_OUT_MS = 260;
// How long a touch taken by a parent list has to come back before the row
// settles as if released.
export const STOLEN_SETTLE_MS = 250;
// Home, open, and back from a peek. Clamped where they head home: past zero
// the row would uncover a sliver of the other side's action.
export const CLOSE_SPRING = { damping: 22, stiffness: 260, mass: 1, overshootClamping: true };
export const PARK_SPRING = { damping: 34, stiffness: 300, mass: 1 };
export const NUDGE_BACK_SPRING = { damping: 14, stiffness: 180, mass: 1, overshootClamping: true };

export interface SwipeSideConfig {
  /** Fraction of screen width this side may travel before it parks. */
  ratio: number;
}

export interface UseSwipeActionsOptions {
  /** Omit a side to disable dragging that way entirely. */
  left?: SwipeSideConfig;
  right?: SwipeSideConfig;
  disabled?: boolean;
}

export interface SwipeActionsState {
  translateX: SharedValue<number>;
  /** A one-off peek toward this side and back, to show the row swipes. */
  nudge: (side: SwipeSide) => void;
  /** Per-side 0..1 travel fraction, for driving the indicator. */
  leftProgress: DerivedValue<number>;
  rightProgress: DerivedValue<number>;
  /** Which side is parked open, or null. Drives which button is rendered. */
  parkedSide: SwipeSide | null;
  close: () => void;
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"] & {
    onTouchStart: (event: GestureResponderEvent) => void;
  };
}
