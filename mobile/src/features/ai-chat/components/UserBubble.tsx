import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GradientFill } from "@/components/ui/GradientFill";
import { CHAT_MODE_META, useChatModeStore } from "@/features/ai-chat/chat-mode";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface UserBubbleProps {
  text: string;
  children?: ReactNode;
}

/**
 * The User's own message, in both panes: a gradient in the current mode's
 * colours (green → mint while recording, mint → blue while asking), so the
 * thread always says which conversation it is — and the User's side is never
 * mistaken for the assistant's grey text. Reads the mode itself rather than
 * taking it as a prop, so neither pane has to thread it down to every row.
 */
export function UserBubble({ text, children }: UserBubbleProps) {
  const mode = useChatModeStore((s) => s.mode);
  const meta = CHAT_MODE_META[mode];

  return (
    <View style={styles.bubble}>
      <GradientFill from={meta.tint} to={meta.accentTo} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "82%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    borderBottomRightRadius: spacing.xs,
    // Clips the gradient to the bubble's own corners.
    overflow: "hidden",
  },
  // Every mode's pair is a light pastel, so dark text reads on all of them.
  text: { ...typography.body, color: colors.onGreen },
});
