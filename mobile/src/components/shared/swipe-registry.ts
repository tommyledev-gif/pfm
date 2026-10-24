import { GestureResponderEvent } from "react-native";

// Only one swipe row anywhere may be parked open at a time (useSwipeActions).
// Module-level rather than per-list, because the two surfaces that use this
// (the chat thread and Home's pending list) are never on screen together but
// share the rule, and a registry scoped per list would have to be threaded
// through context for no benefit. A row is known by its own close function.
let parkedClose: (() => void) | null = null;
// The timestamp of a touch that began on the parked row itself. The row hears
// a touch before the screen around it does (touch events bubble), so the
// screen can tell a tap on the row's own button from a tap elsewhere.
let touchOnParkedRowAt: number | null = null;

/** Closes whichever row is parked open, if any — for a list's scroll start. */
export function closeParkedSwipeRow() {
  const close = parkedClose;
  parkedClose = null;
  close?.();
}

/**
 * For a screen's onTouchStart: a touch anywhere but the parked row closes it,
 * the way tapping beside an open row cancels it in Mail.
 */
export function closeParkedSwipeRowOnOutsideTouch(event: GestureResponderEvent) {
  if (touchOnParkedRowAt !== null && touchOnParkedRowAt === event.nativeEvent.timestamp) return;
  closeParkedSwipeRow();
}

/** `close`'s row parks: whatever else was parked closes first. */
export function registerParkedRow(close: () => void) {
  if (parkedClose && parkedClose !== close) parkedClose();
  parkedClose = close;
}

/** `close`'s row is closing, so it is no longer the parked one. */
export function unregisterParkedRow(close: () => void) {
  if (parkedClose === close) parkedClose = null;
}

/** A row's own onTouchStart: remembers the touch if that row is the parked one. */
export function markTouchOnRow(close: () => void, event: GestureResponderEvent) {
  touchOnParkedRowAt = parkedClose === close ? event.nativeEvent.timestamp : null;
}
