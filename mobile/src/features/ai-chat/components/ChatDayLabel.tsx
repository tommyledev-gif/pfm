import { Text } from "react-native";

import { messageCreatedAt } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatMessage } from "@/features/ai-chat/types";
import { dayLabel } from "@/lib/format-date";
import { spacing, typography, createStyles } from "@/lib/theme";

const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * When the message at `index` of a newest-first (inverted) thread is the
 * first of its day, that day's start time; otherwise undefined. The next item
 * in the array is the one drawn above it. A message without a creation time
 * (ids carry it, message-id.ts) never starts a day.
 */
export function dayStartAt(messages: ChatMessage[], index: number): number | undefined {
  const at = messageCreatedAt(messages[index].id);
  if (at === undefined) return undefined;
  const older = messages[index + 1];
  const olderAt = older ? messageCreatedAt(older.id) : undefined;
  return olderAt !== undefined && dayKey(olderAt) === dayKey(at) ? undefined : at;
}

/** "Hôm nay", "Hôm qua", a date: small, in the pane's own colour, over a day's first message. */
export function ChatDayLabel({ at, tint }: { at: number; tint: string }) {
  const styles = useStyles();
  return (
    <Text style={[styles.label, { color: tint }]} accessibilityRole="header">
      {dayLabel(new Date(at).toISOString())}
    </Text>
  );
}

const useStyles = createStyles(() => ({
  label: { ...typography.tiny, fontWeight: "600", textAlign: "center", paddingVertical: spacing.sm },
}));
