import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_KEYBOARD_GAP, COMPOSER_NAV_CLEARANCE } from "@/features/ai-chat/components/chat-composer-metrics";
import { useKeyboardLiftStyle } from "@/lib/use-keyboard-lift";

// A no-op outside a KeyboardLiftView, so the input bar still renders anywhere.
const ComposerFocusContext = createContext<(source: string, focused: boolean) => void>(() => {});

// Focus moving between two of the composer's fields (the message and the
// phrase search) blurs one before the other gains it. Letting go in that gap
// dropped the bar under a keyboard that never closed — nothing re-engages the
// lift while the keyboard just stays open — so a blur waits this long first.
const FOCUS_HANDOFF_MS = 100;

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
  // Written straight to the UI thread from the inputs' own focus events, so a
  // blur lets go of the lift without waiting for a render. Lifted while any
  // composer field has focus.
  const focusedSources = useRef(new Set<string>());
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportFocus = useCallback(
    (source: string, focused: boolean) => {
      if (focused) focusedSources.current.add(source);
      else focusedSources.current.delete(source);
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
      if (focusedSources.current.size > 0) {
        inputFocused.value = true;
        return;
      }
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null;
        inputFocused.value = false;
      }, FOCUS_HANDOFF_MS);
    },
    [inputFocused],
  );
  useEffect(
    () => () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    },
    [],
  );

  return (
    <ComposerFocusContext.Provider value={reportFocus}>
      <Animated.View style={[styles.lift, liftStyle]}>{children}</Animated.View>
    </ComposerFocusContext.Provider>
  );
}

/** For a composer field: tells the enclosing KeyboardLiftView it gained or lost focus. */
export function useReportComposerFocus() {
  const report = useContext(ComposerFocusContext);
  const source = useId();
  return useCallback((focused: boolean) => report(source, focused), [report, source]);
}

const styles = StyleSheet.create({
  lift: { flex: 1 },
});
