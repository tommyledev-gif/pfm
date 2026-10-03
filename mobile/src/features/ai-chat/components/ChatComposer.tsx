import { ReactNode } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";

interface ChatComposerProps {
  children: ReactNode;
  /** Reports the overlay's full height (chips, suggestions, input and its
   *  keyboard/nav clearance) so the thread can reserve exactly that much. */
  onHeightChange: (height: number) => void;
}

/**
 * Everything at the bottom of a chat pane — suggestions, quick chips and the
 * input — floating over the thread instead of sitting below it.
 *
 * Transparent on purpose: when it sat below the list, the list's bottom edge
 * read as a band behind the chips whenever the thread was scrolled. Messages
 * now pass beneath it; the thread reserves this height so the newest one
 * still rests fully above it. `box-none` lets touches on the empty parts fall
 * through to the message underneath.
 */
export function ChatComposer({ children, onHeightChange }: ChatComposerProps) {
  const handleLayout = (e: LayoutChangeEvent) => onHeightChange(Math.ceil(e.nativeEvent.layout.height));
  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Explicit left/right/bottom: an absolute view without offsets is placed by
  // the parent's alignment instead.
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
