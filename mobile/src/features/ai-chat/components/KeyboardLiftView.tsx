import { createContext, ReactNode, useCallback, useContext } from "react";
import { StyleSheet } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_KEYBOARD_GAP, COMPOSER_NAV_CLEARANCE } from "@/features/ai-chat/components/chat-composer-metrics";
import { useKeyboardLiftStyle } from "@/lib/use-keyboard-lift";

// A no-op outside a KeyboardLiftView, so the input bar still renders anywhere.
const ComposerFocusContext = createContext<(focused: boolean) => void>(() => {});

/**
 * Holds a chat pane's thread and floating composer, and rises with the
 * keyboard so the input stays just above it — the thread shrinks with it, so
 * the newest message stays above the input too.
 *
 * The composer itself never changes height for the keyboard: it would report
 * every animation frame through onLayout and re-render the thread each time.
 *
 * Rises only for the composer's own input, which reports its focus through
 * useReportComposerFocus — see useKeyboardLiftStyle for why the keyboard
 * events alone cannot be trusted to say when to come back down.
 */
export function KeyboardLiftView({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const inputFocused = useSharedValue(false);
  const liftStyle = useKeyboardLiftStyle(insets.bottom + COMPOSER_NAV_CLEARANCE, COMPOSER_KEYBOARD_GAP, inputFocused);
  // Written straight to the UI thread from the input's own focus events, so a
  // blur lets go of the lift without waiting for a render.
  const reportFocus = useCallback(
    (focused: boolean) => {
      inputFocused.value = focused;
    },
    [inputFocused],
  );

  return (
    <ComposerFocusContext.Provider value={reportFocus}>
      <Animated.View style={[styles.lift, liftStyle]}>{children}</Animated.View>
    </ComposerFocusContext.Provider>
  );
}

/** For the composer's input: tells the enclosing KeyboardLiftView it gained or lost focus. */
export function useReportComposerFocus() {
  return useContext(ComposerFocusContext);
}

const styles = StyleSheet.create({
  lift: { flex: 1 },
});
