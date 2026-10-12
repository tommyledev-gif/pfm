import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform } from "react-native";
import {
  KeyboardState,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ⚠️ Both "translucent" flags must stay on. The app is edge-to-edge (RN 0.81)
// and paints its own safe areas; left at Reanimated's defaults, Android adds
// a status-bar and nav-bar margin to the whole activity while this hook is
// mounted, and on unmount switches the window back to fitting system windows
// — every screen would shift by a bar's height on entering and leaving.
const KEYBOARD_OPTIONS = { isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true };

// iOS announces the keyboard as its animation starts; Android only once it
// has finished opening.
const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
// How long a reported opening may go unconfirmed by React Native before it is
// treated as stale. Android's keyboardDidShow lands ~250ms after it starts.
const OPENING_CONFIRM_MS = 1000;

/**
 * Animated style that lifts a container so whatever rests `restingOffset` px
 * above the screen's bottom edge ends up `gap` px above the keyboard. Driven
 * frame by frame on the UI thread, in step with the keyboard's own open and
 * close animation — unlike useKeyboardHeight, whose Android events only fire
 * once the keyboard has finished moving, which made a composer jump after it.
 *
 * The resting element does not move until the keyboard's top reaches it.
 *
 * ⚠️ Reanimated's keyboard height is only believed while React Native agrees a
 * keyboard is up. Reanimated keeps ONE keyboard state for the whole app and
 * stops updating it whenever no hook is subscribed, and on Android it also
 * ignores a drop to height 0 while it thinks the keyboard is open. So a hook
 * mounting after the keyboard closed unobserved — a chat pane swapped in, a
 * JS reload, the app backgrounded with the keyboard up — was handed a stale
 * "open, ~300dp", and the composer sat a keyboard-height above the nav with
 * no keyboard on screen. React Native's own Keyboard events never go stale.
 */
export function useKeyboardLiftStyle(restingOffset: number, gap: number) {
  const keyboard = useAnimatedKeyboard(KEYBOARD_OPTIONS);
  const { bottom } = useSafeAreaInsets();
  // With the nav bar treated as translucent, Android measures the keyboard
  // from the physical bottom of the display, nav bar included (the same
  // correction useKeyboardHeight applies). iOS's height already covers the
  // home-indicator strip.
  const navBarInset = Platform.OS === "android" ? bottom : 0;

  // Trusted at mount only if a keyboard really is open; afterwards from a
  // fresh OPENING (so the lift still tracks the opening frame by frame) or
  // React Native's own show event, until React Native reports it hidden.
  const trusted = useSharedValue(Keyboard.isVisible());
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A stale state can itself read OPENING (the last subscriber left mid-
  // opening). A real one is confirmed by React Native within the second.
  const confirmOpening = useCallback(() => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      if (!Keyboard.isVisible()) trusted.value = false;
    }, OPENING_CONFIRM_MS);
  }, [trusted]);

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, () => {
      trusted.value = true;
    });
    // "did", on both platforms: by then the close animation has run, so
    // dropping trust cannot cut it short.
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      trusted.value = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [trusted]);

  useAnimatedReaction(
    () => keyboard.state.value,
    (state, previous) => {
      if (state === KeyboardState.OPENING && previous !== KeyboardState.OPENING) {
        trusted.value = true;
        runOnJS(confirmOpening)();
      }
    },
  );

  return useAnimatedStyle(() => {
    if (!trusted.value) return { marginBottom: 0 };
    const keyboardTop = Math.max(keyboard.height.value - navBarInset, 0);
    return { marginBottom: keyboardTop > 0 ? Math.max(keyboardTop + gap - restingOffset, 0) : 0 };
  });
}
