import { useEffect, useRef } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import {
  Easing,
  KeyboardState,
  type SharedValue,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
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

// Larger than any lift: the ceiling while the lift follows the keyboard.
const UNCAPPED = 100_000;
// How the lift settles when the keyboard goes without Reanimated animating it
// away. The short delay keeps a keyboard that IS animating the lower of the
// two, so the bar does not dip behind it; when nothing animates, the bar
// still lands about when an Android keyboard would have (~285ms).
const SETTLE_DELAY_MS = 80;
const SETTLE_MS = 250;
const SETTLE_EASING = Easing.inOut(Easing.quad);

/**
 * Animated style that lifts a container so whatever rests `restingOffset` px
 * above the screen's bottom edge ends up `gap` px above the keyboard. Driven
 * frame by frame on the UI thread, in step with the keyboard's own open and
 * close animation — unlike useKeyboardHeight, whose Android events only fire
 * once the keyboard has finished moving, which made a composer jump after it.
 *
 * The resting element does not move until the keyboard's top reaches it.
 *
 * ⚠️ Lifts only for the input that `inputFocused` tracks, and only once a
 * keyboard has been seen opening for it. Neither app-wide keyboard source is
 * safe to believe on its own:
 * - Reanimated keeps ONE keyboard state for the app and only updates it from
 *   insets animations on the activity's window. On Android it also drops a
 *   height of 0 while it thinks the keyboard is OPEN, and a close cut short
 *   ends as OPEN at the height it had reached.
 * - React Native emits keyboardDidHide only from the activity's layout pass,
 *   so it can arrive late or not at all.
 * A Modal is its own Android window: when one takes focus (the hold menu's
 * popover, a picker) the keyboard closes without the activity seeing either
 * signal, and both kept saying "open, ~300dp". The bar stayed lifted under
 * the popover, and any lift mounted later (a pane swapped in, this tab
 * re-shown — tabs stay mounted and saw every other screen's keyboard) sat a
 * keyboard-height above the nav with no keyboard on screen.
 *
 * So the lift lets go — settling down on its own curve, whatever the stale
 * height says — when the input blurs, React Native reports the keyboard
 * hidden, or the app goes to the background. It takes hold again only from
 * live evidence while the input is focused: the keyboard's height rising (an
 * opening, followed from its first frames) or React Native's show event.
 */
export function useKeyboardLiftStyle(restingOffset: number, gap: number, inputFocused: SharedValue<boolean>) {
  const keyboard = useAnimatedKeyboard(KEYBOARD_OPTIONS);
  const { bottom } = useSafeAreaInsets();
  // With the nav bar treated as translucent, Android measures the keyboard
  // from the physical bottom of the display, nav bar included (the same
  // correction useKeyboardHeight applies). iOS's height already covers the
  // home-indicator strip.
  const navBarInset = Platform.OS === "android" ? bottom : 0;

  // Whether the lift follows the keyboard. The ceiling is UNCAPPED while it
  // does; letting go animates the ceiling down to 0 from wherever the lift is.
  const engaged = useSharedValue(false);
  const ceiling = useSharedValue(0);
  // Bumped on React Native's show event; the UI thread checks focus.
  const showCount = useSharedValue(0);
  const showCountRef = useRef(0);

  const liftFor = (height: number) => {
    "worklet";
    const keyboardTop = Math.max(height - navBarInset, 0);
    return keyboardTop > 0 ? Math.max(keyboardTop + gap - restingOffset, 0) : 0;
  };

  // A rising height is a keyboard opening right now — never a stale reading.
  // Not the first report this hook receives, though: that can be the stale
  // height Reanimated replays as an animation starts.
  useAnimatedReaction(
    () => ({ height: keyboard.height.value, state: keyboard.state.value }),
    (now, before) => {
      if (before === null || before.state === KeyboardState.UNKNOWN) return;
      if (now.height > before.height && inputFocused.value) engaged.value = true;
    },
  );

  useAnimatedReaction(
    () => showCount.value,
    (count, before) => {
      if (before !== null && count !== before && inputFocused.value) engaged.value = true;
    },
  );

  // Blurring is the one signal that survives a Modal taking focus: it fires
  // from the input itself (Keyboard.dismiss() before the popover opens).
  useAnimatedReaction(
    () => inputFocused.value,
    (focused, wasFocused) => {
      if (wasFocused && !focused) engaged.value = false;
    },
  );

  useAnimatedReaction(
    () => engaged.value,
    (isEngaged, wasEngaged) => {
      if (wasEngaged === null || isEngaged === wasEngaged) return;
      if (isEngaged) {
        ceiling.value = UNCAPPED;
        return;
      }
      ceiling.value = Math.min(liftFor(keyboard.height.value), ceiling.value);
      ceiling.value = withDelay(SETTLE_DELAY_MS, withTiming(0, { duration: SETTLE_MS, easing: SETTLE_EASING }));
    },
  );

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, () => {
      showCountRef.current += 1;
      showCount.value = showCountRef.current;
    });
    // "did", on both platforms: by then the close animation has run, so
    // letting go cannot cut it short.
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      engaged.value = false;
    });
    // The keyboard goes with the app, often unseen. If it comes back on
    // return, its opening takes hold again.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "background") engaged.value = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, [engaged, showCount]);

  return useAnimatedStyle(() => ({
    marginBottom: Math.min(liftFor(keyboard.height.value), ceiling.value),
  }));
}
