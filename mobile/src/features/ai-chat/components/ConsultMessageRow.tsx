import { StyleSheet, Text, View } from "react-native";

import { UserBubble } from "@/features/ai-chat/components/UserBubble";
import { ChatMessage } from "@/features/ai-chat/types";
import { ConsultHandlers, ConsultReplyCard } from "@/features/analytics/components/ConsultReplyCard";
import { colors, spacing, typography } from "@/lib/theme";

interface ConsultMessageRowProps {
  message: ChatMessage;
  /** Opens a new exchange — spaced further from the message before it than a
   *  reply is from its own question, so turns read as groups. */
  startsTurn: boolean;
  handlers: ConsultHandlers;
}

// Between turns vs. within one: the gap has to differ enough to be seen.
const TURN_GAP = spacing.xxl;
const IN_TURN_GAP = spacing.sm;

/**
 * One message of the analysis thread.
 *
 * The assistant's reply is not a bubble: its text sits on the app's own
 * ground, left-aligned and full width, and only its data (the chart, the
 * list) gets a surface. The User's question is the mode's gradient bubble
 * (UserBubble, the same one the recording pane uses), so the two sides of
 * the conversation are told apart at a glance. The recording pane keeps
 * ChatBubble around it: its proposals are cards the User acts on, which is
 * a different job.
 */
export function ConsultMessageRow({ message, startsTurn, handlers }: ConsultMessageRowProps) {
  const gap = { marginTop: startsTurn ? TURN_GAP : IN_TURN_GAP };

  if (message.role === "user") {
    return (
      <View style={[styles.userRow, gap]}>
        <UserBubble text={message.text} />
      </View>
    );
  }

  return (
    <View style={gap}>
      {message.text ? <Text style={styles.assistantText}>{message.text}</Text> : null}
      {message.consult ? <ConsultReplyCard data={message.consult} handlers={handlers} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  assistantText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
});
