import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";

// Slide distance only has to clear the screen, so it is the window height.
export const OFFSCREEN_Y = Dimensions.get("window").height;
// ⚠️ Closing slides the sheet down by its own height (plus a margin), on an
// even curve. It used to travel the whole window height on an ease-out in
// 280ms: a short sheet left the screen in its first few dozen ms, so a tap
// outside read as the sheet being cut off.
const CLOSE_MS = 320;
const CLOSE_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const CLOSE_MARGIN = 48;
// ⚠️ Opening mirrors that: up from just below the screen's edge, critically
// damped and clamped, so it lands without passing its height. It used to come
// the whole window height on a bouncy spring: a short sheet crossed most of
// that unseen, arrived at speed and rose ~24px past its height before
// settling back — "too high, then snaps down".
const OPEN_SPRING = { stiffness: 260, damping: 32, mass: 1, overshootClamping: true, useNativeDriver: true };
// How long an open waits for the layout of what the host just handed the sheet
// (see `requestSlide`): a couple of frames.
const OPEN_LAYOUT_WAIT_MS = 40;
// The longest an open is held for content that is still loading (`useOpenHold`).
const OPEN_HOLD_MS = 320;

interface UseDrawerMotionOptions {
  visible: boolean;
  /** Mounted already open: shows in place, no slide. */
  startOpen: boolean;
  /** The close slide has finished. */
  onExited: () => void;
  /** The overlay sits where it will stay (useOverlayOrigin's `measured`): the open slide waits for it. */
  ready: boolean;
  /** The content is not waiting on anything (useOpenHold): the open slide waits for this too. */
  contentReady: boolean;
  /** The open slide is starting: the moment the sheet is on its way up. */
  onSlideStart: () => void;
}

/**
 * Holds an open slide for content that is still on its way, so the sheet
 * rises once with its rows in place instead of rising on a skeleton that then
 * changes height under the slide. Never longer than OPEN_HOLD_MS: on a slow
 * answer the sheet comes up with its skeleton, as before.
 *
 * Returns whether the slide may go ahead.
 */
export function useOpenHold(visible: boolean, hold: boolean) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!visible) {
      setExpired(false);
      return;
    }
    if (!hold) return;
    const timer = setTimeout(() => setExpired(true), OPEN_HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible, hold]);
  return !hold || expired;
}

/**
 * The sheet's slide and the dim behind it, for Drawer.
 *
 * ⚠️ The dim is read off the sheet's own position, not timed on its own. It
 * used to fade in over 200ms the moment `visible` flipped, while the sheet
 * still waited for its first layout before moving: the screen went dark at
 * once and the sheet came up into it afterwards, which read as sudden. Now
 * the dim is exactly as far in as the sheet is: it rises with the slide,
 * falls with the close, and follows a drag on the handle too.
 *
 * ⚠️ …which makes it a ratio of the slide to `travel` (the sheet's height),
 * so `travel` must not change while the sheet is moving. It used to follow
 * every layout: content landing under a slide (a form's fields, a list's rows
 * replacing its skeleton, a sheet kept mounted opening on another record) set
 * a new height, and the dim jumped to a new value in one frame — the overlay
 * "flashing". `travel` is now taken only while the sheet is still, and read
 * once more as each move starts.
 *
 * `settled` turns true once the open slide has landed and false as a close
 * starts. Drawer only lets its height glide (SHEET_RESIZE) while settled: a
 * height change during the slide used to run a second spring on the same
 * sheet, and the two read as shaking.
 */
export function useDrawerMotion({
  visible,
  startOpen,
  onExited,
  ready,
  contentReady,
  onSlideStart,
}: UseDrawerMotionOptions) {
  // Everything the open slide waits for, read at the moment it would start.
  const canSlideRef = useRef(ready && contentReady);
  canSlideRef.current = ready && contentReady;
  const onSlideStartRef = useRef(onSlideStart);
  onSlideStartRef.current = onSlideStart;
  const translateY = useRef(new Animated.Value(startOpen ? 0 : OFFSCREEN_Y)).current;
  // Resting → hidden distance: the sheet's height plus the margin, once known.
  const travel = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  // Built once: a fresh node on a native-driven view drops it back to its
  // defaults until the new one attaches, a frame of full dim.
  const [dimOpacity] = useState(() =>
    Animated.divide(translateY, travel).interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" }),
  );
  const [settled, setSettled] = useState(startOpen);
  // The sheet's last measured height: how far closing has to slide it.
  const sheetHeight = useRef(0);
  // True from the start of an open or close slide to its end: `travel` holds.
  const moving = useRef(false);
  // An open waiting for the sheet's first layout: only that says how far
  // below the edge the slide starts. `slidIn`: it has started once already,
  // so a reopen mid-close goes on from where the sheet is.
  const pendingOpen = useRef(false);
  const slidIn = useRef(startOpen);
  const layoutWait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const clearLayoutWait = () => {
    if (layoutWait.current) clearTimeout(layoutWait.current);
    layoutWait.current = null;
  };
  const takeTravel = () => {
    if (sheetHeight.current > 0) travel.setValue(sheetHeight.current + CLOSE_MARGIN);
  };

  const slideIn = () => {
    clearLayoutWait();
    pendingOpen.current = false;
    moving.current = true;
    takeTravel();
    if (!slidIn.current) translateY.setValue(sheetHeight.current + CLOSE_MARGIN);
    slidIn.current = true;
    onSlideStartRef.current();
    Animated.spring(translateY, { toValue: 0, ...OPEN_SPRING }).start(({ finished }) => {
      if (!finished) return;
      moving.current = false;
      // At rest the ratio is 0 whatever `travel` is: catching up with a height
      // that changed under the slide moves nothing, and a drag starts true.
      takeTravel();
      setSettled(true);
    });
  };

  // ⚠️ An open does not slide on the height it last knew. A sheet kept mounted
  // (or one whose content just finished loading) is handed new content in the
  // same commit that opens it, and its layout arrives a frame or two later —
  // onLayout fires only for a change. Sliding at once started from the old
  // height: a taller sheet popped its top edge in on the first frame, a
  // shorter one was late. So the slide goes when that layout is reported
  // (onSheetHeight), or after OPEN_LAYOUT_WAIT_MS if the height did not change.
  const requestSlide = () => {
    pendingOpen.current = true;
    clearLayoutWait();
    layoutWait.current = setTimeout(() => {
      layoutWait.current = null;
      if (pendingOpen.current && canSlideRef.current && sheetHeight.current > 0) slideIn();
    }, OPEN_LAYOUT_WAIT_MS);
  };

  useEffect(() => {
    if (visible) {
      if (sheetHeight.current > 0 && canSlideRef.current) requestSlide();
      else pendingOpen.current = true;
      return;
    }
    clearLayoutWait();
    // Mounted closed (Drawer's keepMounted): nothing to close.
    if (!slidIn.current && !pendingOpen.current) return;
    pendingOpen.current = false;
    setSettled(false);
    moving.current = true;
    Animated.timing(translateY, {
      toValue: sheetHeight.current > 0 ? sheetHeight.current + CLOSE_MARGIN : OFFSCREEN_Y,
      duration: CLOSE_MS,
      easing: CLOSE_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      // A sheet kept mounted waits a whole window below the edge, not just
      // under it: the keyboard (the backdrop's padding) lifts the closed
      // sheet too, and from just under the edge that brought it into view.
      // The next open starts from just under the edge again.
      slidIn.current = false;
      moving.current = false;
      translateY.setValue(OFFSCREEN_Y);
      takeTravel();
      onExitedRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => clearLayoutWait, []);

  const onSheetHeight = (height: number) => {
    sheetHeight.current = height;
    if (!moving.current) travel.setValue(height + CLOSE_MARGIN);
    if (pendingOpen.current && canSlideRef.current) slideIn();
  };

  // The other half of the wait: the sheet was laid out before the overlay's
  // position came back. Its content is as it was laid out: slide at once.
  useEffect(() => {
    if (ready && contentReady && pendingOpen.current && sheetHeight.current > 0) slideIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // …or before its content was ready: the rows that were being waited for have
  // just landed, so their layout is still on its way (see requestSlide).
  useEffect(() => {
    if (ready && contentReady && pendingOpen.current && sheetHeight.current > 0) requestSlide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentReady]);

  return { translateY, dimOpacity, settled, onSheetHeight };
}
