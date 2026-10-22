import { useSyncExternalStore } from "react";
import { Dimensions, Keyboard, LayoutAnimation, Platform, UIManager, useWindowDimensions } from "react-native";
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

// One set of keyboard listeners for the whole app, installed at load, so a
// component mounted while the keyboard is already open (a sheet opened from a
// focused field) reads the right height at once, and each event costs one
// update instead of one per mounted component.
let rawHeight = 0;
let visible = false;
// The window height with the keyboard closed. Some Android devices shrink the
// window for the keyboard ("resize"); the shrink is subtracted so the height
// is never counted twice. Re-captured on a timer after the keyboard hides,
// never from a window change: the shrink can land before keyboardDidShow,
// and capturing then would record the already-shrunk height.
let windowBeforeKeyboard = Dimensions.get("window").height;
let baselineTimer: ReturnType<typeof setTimeout> | null = null;
const heightListeners = new Set<() => void>();
const visibleListeners = new Set<() => void>();

function notify() {
  heightListeners.forEach((listener) => listener());
  visibleListeners.forEach((listener) => listener());
}

Keyboard.addListener(SHOW_EVENT, (e) => {
  if (baselineTimer) {
    clearTimeout(baselineTimer);
    baselineTimer = null;
  }
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  rawHeight = e.endCoordinates.height;
  visible = true;
  notify();
});

Keyboard.addListener(HIDE_EVENT, () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  rawHeight = 0;
  visible = false;
  notify();
  if (baselineTimer) clearTimeout(baselineTimer);
  baselineTimer = setTimeout(() => {
    baselineTimer = null;
    windowBeforeKeyboard = Dimensions.get("window").height;
  }, WINDOW_RESTORE_MS);
});

function subscribeHeight(listener: () => void) {
  heightListeners.add(listener);
  return () => {
    heightListeners.delete(listener);
  };
}

function subscribeVisible(listener: () => void) {
  visibleListeners.add(listener);
  return () => {
    visibleListeners.delete(listener);
  };
}

/**
 * The keyboard's height in px (0 when hidden), for pushing content up with
 * plain margin/padding — never KeyboardAvoidingView, whose Android "height"
 * mode fails to restore layout once the keyboard closes (RN#22884).
 */
export function useKeyboardHeight(): number {
  const { bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const raw = useSyncExternalStore(subscribeHeight, () => rawHeight);
  if (raw === 0 || Platform.OS !== "android") return raw;
  // Edge-to-edge Android measures the keyboard from the physical bottom of
  // the display, nav bar included.
  const keyboard = Math.max(raw - bottom, 0);
  const alreadyShrunk = Math.max(windowBeforeKeyboard - windowHeight, 0);
  return Math.max(keyboard - alreadyShrunk, 0);
}

/**
 * Whether the keyboard is open, independent of how much padding anyone needs.
 *
 * ⚠️ Use this, not `useKeyboardHeight() > 0`, for anything that hides or shows on
 * the keyboard — the bottom nav, a quick-action row. The height is an ADJUSTED
 * figure: on a device where the OS already shrinks the window it is legitimately
 * zero while the keyboard is fully open.
 */
export function useKeyboardVisible(): boolean {
  return useSyncExternalStore(subscribeVisible, () => visible);
}
