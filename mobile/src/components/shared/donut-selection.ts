import { GestureResponderEvent } from "react-native";

// A donut's selected slice (and the tooltip that opens on it) stays until
// something clears it. Tapping the slice or its legend row again does; so does
// a tap anywhere else on the screen, the way a menu or a tooltip closes when
// you press beside it.
//
// Module-level, like swipe-registry.ts: the chart is controlled by whichever
// screen owns it (Insights, a chat answer), and the screen is what hears the
// tap elsewhere, so the two meet here instead of being threaded through props.
// The chart registers how to clear its selection while it has one; a screen
// passes `clearDonutSelectionOnOutsideTouch` as its onTouchStart.
let activeClear: (() => void) | null = null;
// The timestamp of a touch that began on the chart or its legend. They hear a
// touch before the screen around them does (touch events bubble), so the screen
// can tell a tap on the donut's own parts from a tap elsewhere.
let touchOnDonutAt: number | null = null;

/** The donut has a selection; `clear` drops it. Returns the unregister. */
export function registerDonutSelection(clear: () => void) {
  activeClear = clear;
  return () => {
    if (activeClear === clear) activeClear = null;
  };
}

/** For the onTouchStart of the chart, its legend rows and anything else that selects a slice. */
export function markDonutTouch(event: GestureResponderEvent) {
  touchOnDonutAt = event.nativeEvent.timestamp;
}

/** For a screen's onTouchStart: a touch anywhere but the donut or its legend clears the selection. */
export function clearDonutSelectionOnOutsideTouch(event: GestureResponderEvent) {
  if (touchOnDonutAt !== null && touchOnDonutAt === event.nativeEvent.timestamp) return;
  const clear = activeClear;
  activeClear = null;
  clear?.();
}
