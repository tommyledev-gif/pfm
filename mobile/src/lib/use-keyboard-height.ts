import { useEffect, useRef, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, UIManager, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Pre-Fabric Android silently no-ops LayoutAnimation without this opt-in;
// guarded since the API isn't guaranteed present under the new architecture.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// iOS fires "will" events before the keyboard animation starts (letting UI
// animate in step with it); Android only reliably fires "did" events.
const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

// How long to wait after the keyboard hides before trusting the window height
// again — it takes a frame or two to grow back to full size.
const WINDOW_RESTORE_MS = 300;

// Returns the live keyboard height in px (0 when hidden) instead of just a
// boolean, so callers can push content up by exactly that amount using
// plain flex/margin math — deliberately not KeyboardAvoidingView, whose
// Android "height" behavior has a long-standing bug where it fails to
// restore the original layout once the keyboard closes (facebook/react-
// native#22884 and friends), which is exactly the "stuck pushed up after
// closing the keyboard" symptom this replaced.
export function useKeyboardHeight(): number {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rawHeight, setRawHeight] = useState(0);
  // Some real Android devices (softwareKeyboardLayoutMode: "resize" in
  // app.json) DO shrink the window when the keyboard opens — RN reports the
  // shrink through useWindowDimensions the moment it happens — despite RN
  // 0.81's edge-to-edge default suggesting otherwise. Manually adding the
  // full raw keyboard height on top of a window the OS already shrank
  // double-counts it, leaving a dead gap between the input bar and the
  // keyboard exactly one keyboard-height tall. windowBeforeKeyboard freezes
  // the last known keyboard-hidden window height so the shrink amount can be
  // measured and subtracted back out.
  const windowBeforeKeyboard = useRef(windowHeight);
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;

  // ⚠️ The baseline is re-captured on a TIMER after the keyboard hides, never
  // straight from a windowHeight change.
  //
  // It used to be `if (rawHeight === 0) windowBeforeKeyboard.current = windowHeight`,
  // which lost a race it could not win: Android shrinks the window and fires
  // keyboardDidShow on independent schedules, and when the shrink lands FIRST
  // that effect ran while rawHeight was still 0 and recorded the ALREADY-SHRUNK
  // height as the baseline. `alreadyShrunk` then computed to zero, the hook
  // returned the full keyboard height on a window that had already made room,
  // and every caller pushed its content up by a second keyboard height — the
  // dead gap between the chat input and the keyboard.
  //
  // Keying the effect on rawHeight alone means a mid-open window shrink cannot
  // re-trigger it, and the delay lets the window grow back before the next
  // baseline is taken.
  useEffect(() => {
    if (rawHeight !== 0) return;
    const timer = setTimeout(() => {
      windowBeforeKeyboard.current = windowHeightRef.current;
    }, WINDOW_RESTORE_MS);
    return () => clearTimeout(timer);
  }, [rawHeight]);

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const raw = e.endCoordinates.height;
      // RN 0.81 forces edge-to-edge on Android, so on devices where the
      // window truly never resizes, this event's height is measured from
      // the true physical bottom of the display — i.e. it includes the nav
      // bar, not just the keyboard surface above it. iOS's keyboardWillShow
      // height is already correct (it visually covers the home-indicator
      // area).
      setRawHeight(Platform.OS === "android" ? Math.max(raw - insets.bottom, 0) : raw);
    });
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRawHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  if (Platform.OS !== "android" || rawHeight === 0) return rawHeight;
  const alreadyShrunk = Math.max(windowBeforeKeyboard.current - windowHeight, 0);
  return Math.max(rawHeight - alreadyShrunk, 0);
}

/**
 * Whether the keyboard is open, independent of how much padding anyone needs.
 *
 * ⚠️ Use this, not `useKeyboardHeight() > 0`, for anything that hides or shows on
 * the keyboard — the bottom nav, a quick-action row. The height is an ADJUSTED
 * figure: on a device where the OS already shrinks the window it is legitimately
 * zero while the keyboard is fully open, so treating it as a visibility flag
 * would leave the nav bar on screen exactly where the resize made room for it.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, () => setVisible(true));
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
