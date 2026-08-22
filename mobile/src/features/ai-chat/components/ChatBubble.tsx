import { ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";

interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
  children?: ReactNode;
  // When set, draws a fading border ring around this bubble — used by
  // ai-chat.tsx's "go to original" navigation to make the scrolled-to
  // message obvious for a few seconds. Undefined renders no ring at all
  // (not just opacity 0) so it costs nothing on the common case.
  highlightOpacity?: Animated.Value;
}

// README: "user messages = lavender bubble, right-aligned, dark text. AI
// messages = dark surface bubble, left-aligned, white text."
export function ChatBubble({ role, text, children, highlightOpacity }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={isUser ? styles.textUser : styles.textAssistant}>{text}</Text>
        {children}
        {highlightOpacity ? (
          <Animated.View pointerEvents="none" style={[styles.highlightRing, { opacity: highlightOpacity }]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radii.listCard, padding: spacing.lg },
  bubbleUser: { backgroundColor: colors.mustard, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderBottomLeftRadius: 4 },
  textUser: { ...typography.body, color: colors.onGreen },
  textAssistant: { ...typography.body, color: colors.textPrimary },
  highlightRing: {
    ...StyleSheet.absoluteFillObject,
    margin: -3,
    borderWidth: 2,
    borderColor: colors.lavender,
    borderRadius: radii.listCard,
  },
});
