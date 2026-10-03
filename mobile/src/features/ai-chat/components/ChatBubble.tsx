import { ReactNode } from "react";
import { Text, View } from "react-native";

import { UserBubble } from "@/features/ai-chat/components/UserBubble";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
  children?: ReactNode;
}

// An empty string is a deliberate caller choice, not missing data: a removed
// proposal's tombstone says everything the bubble text used to, so repeating
// "please confirm this" above a card that can no longer be confirmed would
// contradict it.

// User messages = the mode's gradient bubble (UserBubble, shared with the
// analysis pane), right-aligned, dark text. AI messages = dark surface
// bubble, left-aligned, white text.
export function ChatBubble({ role, text, children }: ChatBubbleProps) {
  const styles = useStyles();
  if (role === "user") {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <UserBubble text={text}>{children}</UserBubble>
      </View>
    );
  }
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View style={[styles.bubble, styles.bubbleAssistant]}>
        {text ? <Text style={styles.textAssistant}>{text}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { width: "100%", flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radii.listCard, padding: spacing.lg },
  bubbleAssistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderBottomLeftRadius: 4 },
  textAssistant: { ...typography.body, color: colors.textPrimary },
}));
