import { memo, useCallback } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";

import { useFreshEntrance } from "@/components/motion/use-fresh-entrance";
import { ActionPopover } from "@/components/shared/ActionPopover";
import { UserBubble } from "@/features/ai-chat/components/UserBubble";
import { messageCreatedAt } from "@/features/ai-chat/components/ChatMessageRow";
import { isFailureReply } from "@/features/ai-chat/failure-reply";
import { useDismissCollapse } from "@/features/ai-chat/hooks/use-dismiss-collapse";
import { useHoldMenu } from "@/features/ai-chat/hooks/use-hold-menu";
import { useChatStore } from "@/stores/chat-store";
import { useMessageActions } from "@/features/ai-chat/hooks/use-message-actions";
import { messageText } from "@/features/ai-chat/message-text";
import { ChatMessage } from "@/features/ai-chat/types";
import { ConsultHandlers, ConsultReplyCard } from "@/features/analytics/components/ConsultReplyCard";
import { useAnchoredLongPress } from "@/features/ai-chat/hooks/use-anchored-long-press";
import { MESSAGE_HOLD_MS } from "@/lib/gestures";
import { spacing, typography, createStyles } from "@/lib/theme";

interface ConsultMessageRowProps {
  message: ChatMessage;
  /** Opens a new exchange — spaced further from the message before it than a
   *  reply is from its own question, so turns read as groups. */
  startsTurn: boolean;
  handlers: ConsultHandlers;
}

interface ConsultMessageRowViewProps extends ConsultMessageRowProps {
  /** Deletes the message: given only to a failure reply (failure-reply.ts). */
  onDismiss?: () => void;
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
 *
 * Like ChatMessageRow, only a message that has just arrived rises in.
 */
function ConsultMessageRowView({ message, startsTurn, handlers, onDismiss }: ConsultMessageRowViewProps) {
  const styles = useStyles();
  // Re-renders the row on a language switch: an app reply follows it (message-text.ts).
  useTranslation();
  const gap = { marginTop: startsTurn ? TURN_GAP : IN_TURN_GAP };
  const entering = useFreshEntrance(messageCreatedAt(message.id));
  const menu = useHoldMenu();
  // Analysis messages are never swiped: a hold offers Copy, and Delete on a
  // failure reply ("Chưa trả lời được câu này.").
  const menuActions = useMessageActions({ message, onDelete: onDismiss });
  const onLongPress = menuActions.length > 0 ? menu.open : undefined;
  // The assistant's text has no bubble of its own, so it measures itself here.
  const assistantText = useAnchoredLongPress(onLongPress);
  const popup = (
    <ActionPopover
      visible={menu.visible}
      anchor={menu.anchor}
      align={message.role === "user" ? "right" : "left"}
      onClose={menu.close}
      actions={menuActions}
    />
  );

  if (message.role === "user") {
    return (
      <Animated.View entering={entering} style={[styles.userRow, gap]}>
        <UserBubble text={message.text} onLongPress={onLongPress} testID={`msg-consult-${message.id}`} />
        {popup}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={entering} style={gap}>
      {/* Only the text is the hold target — the chart and chips below it
          have taps of their own. */}
      {message.text ? (
        <Pressable
          ref={assistantText.ref}
          testID={`msg-consult-${message.id}`}
          onLongPress={assistantText.handleLongPress}
          delayLongPress={MESSAGE_HOLD_MS}
          disabled={!onLongPress}
        >
          <Text style={styles.assistantText}>{messageText(message)}</Text>
        </Pressable>
      ) : null}
      {message.consult ? (
        <ConsultReplyCard data={message.consult} handlers={handlers} sourceText={message.sourceText} message={message} />
      ) : null}
      {popup}
    </Animated.View>
  );
}

// A failure reply folds away, then leaves the thread; only those rows carry
// the fold's animated style.
function ConsultFailureRow(props: ConsultMessageRowProps) {
  const { id } = props.message;
  const remove = useCallback(() => useChatStore.getState().updateMessage(id, { dismissed: true }), [id]);
  const collapse = useDismissCollapse(remove);
  return (
    <Animated.View onLayout={collapse.onLayout} style={collapse.style}>
      <ConsultMessageRowView {...props} onDismiss={collapse.dismiss} />
    </Animated.View>
  );
}

export const ConsultMessageRow = memo(function ConsultMessageRow(props: ConsultMessageRowProps) {
  return isFailureReply(props.message) ? <ConsultFailureRow {...props} /> : <ConsultMessageRowView {...props} />;
});

const useStyles = createStyles((colors) => ({
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  assistantText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
}));
