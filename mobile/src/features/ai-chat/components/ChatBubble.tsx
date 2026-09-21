import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";

interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
  children?: ReactNode;
}

// An empty string is a deliberate caller choice, not missing data: a removed
// proposal's tombstone says everything the bubble text used to, so repeating
// "please confirm this" above a card that can no longer be confirmed would
// contradict it.

// README: "user messages = lavender bubble, right-aligned, dark text. AI
// messages = dark surface bubble, left-aligned, white text."
export function ChatBubble({ role, text, children }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {text ? <Text style={isUser ? styles.textUser : styles.textAssistant}>{text}</Text> : null}
        {children}
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
});
