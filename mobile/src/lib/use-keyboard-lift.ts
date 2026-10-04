import { Platform } from "react-native";
import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ⚠️ Both "translucent" flags must stay on. The app is edge-to-edge (RN 0.81)
// and paints its own safe areas; left at Reanimated's defaults, Android adds
// a status-bar and nav-bar margin to the whole activity while this hook is
// mounted, and on unmount switches the window back to fitting system windows
// — every screen would shift by a bar's height on entering and leaving.
const KEYBOARD_OPTIONS = { isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true };

/**
 * Animated style that lifts a container so whatever rests `restingOffset` px
 * above the screen's bottom edge ends up `gap` px above the keyboard. Driven
 * frame by frame on the UI thread, in step with the keyboard's own open and
 * close animation — unlike useKeyboardHeight, whose Android events only fire
 * once the keyboard has finished moving, which made a composer jump after it.
 *
 * The resting element does not move until the keyboard's top reaches it.
 */
export function useKeyboardLiftStyle(restingOffset: number, gap: number) {
  const keyboard = useAnimatedKeyboard(KEYBOARD_OPTIONS);
  const { bottom } = useSafeAreaInsets();
  // With the nav bar treated as translucent, Android measures the keyboard
  // from the physical bottom of the display, nav bar included (the same
  // correction useKeyboardHeight applies). iOS's height already covers the
  // home-indicator strip.
  const navBarInset = Platform.OS === "android" ? bottom : 0;

  return useAnimatedStyle(() => {
    const keyboardTop = Math.max(keyboard.height.value - navBarInset, 0);
    return { marginBottom: keyboardTop > 0 ? Math.max(keyboardTop + gap - restingOffset, 0) : 0 };
  });
}
