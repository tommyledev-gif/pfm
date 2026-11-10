import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_KEYBOARD_GAP, COMPOSER_NAV_CLEARANCE } from "@/features/ai-chat/components/chat-composer-metrics";
import { useKeyboardLiftStyle } from "@/lib/use-keyboard-lift";

// A no-op outside a KeyboardLiftView, so the input bar still renders anywhere.
const ComposerFocusContext = createContext<(source: string, focused: boolean) => void>(() => {});
// How far the open keyboard has lifted the pane (0 when closed). 0 outside one.
const KeyboardReserveContext = createContext(0);

// Focus moving between two of the composer's fields (the message and the
// phrase search) blurs one before the other gains it. Letting go in that gap
// dropped the bar under a keyboard that never closed — nothing re-engages the
// lift while the keyboard just stays open — so a blur waits this long first.
const FOCUS_HANDOFF_MS = 100;

/**
 * Holds a chat pane's thread and floating composer, and rises with the
 * keyboard so the input stays just above it, the newest message with it.
 *
 * Rises by translating, clipped at the pane's top: the thread's oldest rows
 * slide out under the header rather than the thread being laid out shorter
 * on every frame (see useKeyboardLiftStyle). Once the keyboard is open the
 * thread adds the lift at its far end (useKeyboardReserve), so its oldest
 * message can still be scrolled into view.
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
  const [reserve, setReserve] = useState(0);
  const liftStyle = useKeyboardLiftStyle(
    insets.bottom + COMPOSER_NAV_CLEARANCE,
    COMPOSER_KEYBOARD_GAP,
    inputFocused,
    setReserve,
  );
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
      <KeyboardReserveContext.Provider value={reserve}>
        <View style={styles.clip}>
          <Animated.View style={[styles.lift, liftStyle]}>{children}</Animated.View>
        </View>
      </KeyboardReserveContext.Provider>
    </ComposerFocusContext.Provider>
  );
}

/** For a composer field: tells the enclosing KeyboardLiftView it gained or lost focus. */
export function useReportComposerFocus() {
  const report = useContext(ComposerFocusContext);
  const source = useId();
  return useCallback((focused: boolean) => report(source, focused), [report, source]);
}

/** For the thread: room to keep at its far end while the keyboard is open. */
export function useKeyboardReserve() {
  return useContext(KeyboardReserveContext);
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: "hidden" },
  lift: { flex: 1 },
});
