import { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_KEYBOARD_GAP, COMPOSER_NAV_CLEARANCE } from "@/features/ai-chat/components/chat-composer-metrics";
import { useKeyboardLiftStyle } from "@/lib/use-keyboard-lift";

/**
 * Holds a chat pane's thread and floating composer, and rises with the
 * keyboard so the input stays just above it — the thread shrinks with it, so
 * the newest message stays above the input too.
 *
 * The composer itself never changes height for the keyboard: it would report
 * every animation frame through onLayout and re-render the thread each time.
 */
export function KeyboardLiftView({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const liftStyle = useKeyboardLiftStyle(insets.bottom + COMPOSER_NAV_CLEARANCE, COMPOSER_KEYBOARD_GAP);
  return <Animated.View style={[styles.lift, liftStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  lift: { flex: 1 },
});
