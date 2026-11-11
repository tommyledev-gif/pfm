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

interface UseDrawerMotionOptions {
  visible: boolean;
  /** Mounted already open: shows in place, no slide. */
  startOpen: boolean;
  /** The close slide has finished. */
  onExited: () => void;
  /** The overlay sits where it will stay (useOverlayOrigin's `measured`): the open slide waits for it. */
  ready: boolean;
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
 * `settled` turns true once the open slide has landed and false as a close
 * starts. Drawer only lets its height glide (SHEET_RESIZE) while settled: a
 * height change during the slide used to run a second spring on the same
 * sheet, and the two read as shaking.
 */
export function useDrawerMotion({ visible, startOpen, onExited, ready }: UseDrawerMotionOptions) {
  const readyRef = useRef(ready);
  readyRef.current = ready;
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
  // An open waiting for the sheet's first layout: only that says how far
  // below the edge the slide starts. `slidIn`: it has started once already,
  // so a reopen mid-close goes on from where the sheet is.
  const pendingOpen = useRef(false);
  const slidIn = useRef(startOpen);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const slideIn = () => {
    pendingOpen.current = false;
    if (!slidIn.current) translateY.setValue(sheetHeight.current + CLOSE_MARGIN);
    slidIn.current = true;
    Animated.spring(translateY, { toValue: 0, ...OPEN_SPRING }).start(({ finished }) => {
      if (finished) setSettled(true);
    });
  };

  useEffect(() => {
    if (visible) {
      if (sheetHeight.current > 0 && readyRef.current) slideIn();
      else pendingOpen.current = true;
      return;
    }
    pendingOpen.current = false;
    setSettled(false);
    Animated.timing(translateY, {
      toValue: sheetHeight.current > 0 ? sheetHeight.current + CLOSE_MARGIN : OFFSCREEN_Y,
      duration: CLOSE_MS,
      easing: CLOSE_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onExitedRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onSheetHeight = (height: number) => {
    sheetHeight.current = height;
    travel.setValue(height + CLOSE_MARGIN);
    if (pendingOpen.current && readyRef.current) slideIn();
  };

  // The other half of the wait: the sheet was laid out before the overlay's
  // position came back.
  useEffect(() => {
    if (ready && pendingOpen.current && sheetHeight.current > 0) slideIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return { translateY, dimOpacity, settled, onSheetHeight };
}
