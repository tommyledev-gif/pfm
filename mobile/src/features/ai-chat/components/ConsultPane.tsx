import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, ListRenderItemInfo, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { clearDonutSelectionOnOutsideTouch } from "@/components/shared/donut-selection";
import { ChatComposer } from "@/features/ai-chat/components/ChatComposer";
import { dayStartAt } from "@/features/ai-chat/components/ChatDayLabel";
import { ChatRowFrame } from "@/features/ai-chat/components/ChatRowFrame";
import { ChatThreadSkeleton } from "@/features/ai-chat/components/ChatThreadSkeleton";
import { ConsultEmptyState } from "@/features/ai-chat/components/ConsultEmptyState";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { KeyboardLiftView } from "@/features/ai-chat/components/KeyboardLiftView";
import { ConsultMessageRow } from "@/features/ai-chat/components/ConsultMessageRow";
import { IntentionSheetsHost } from "@/features/spending-intentions/components/IntentionSheetsHost";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { CHAT_MODE_META } from "@/features/ai-chat/chat-mode";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { isShown } from "@/features/ai-chat/failure-reply";
import { useConsultActions } from "@/features/ai-chat/hooks/use-consult-actions";
import { MessageJump, useMessageJump } from "@/features/ai-chat/hooks/use-message-jump";
import { ChatMessage } from "@/features/ai-chat/types";
import { StarterChipsRow } from "@/features/analytics/components/StarterChipsRow";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing } from "@/lib/theme";
import { useChatStore } from "@/stores/chat-store";

// The assistant is pulling the figures the question asks about.
const ANSWERING_LABEL = "chat.consult.answering";

const messageKey = (m: ChatMessage) => m.id;

interface ConsultPaneProps {
  /** The saved thread is still being read back: a skeleton, not the empty state. */
  loading: boolean;
  bottomInset: number;
  /** `prefill` = the question to carry into the recording input. */
  onSwitchToRecording: (prefill?: string) => void;
  /** A message to scroll to and light up: a search result. */
  jump: MessageJump | null;
}

/**
 * The "Hỏi phân tích" conversation (specs/ai-chat-query-spending): its own
 * thread, typing indicator, starter chips and input. No swipe rows — answers
 * are snapshots, never edited or removed.
 */
export function ConsultPane({ loading, bottomInset, onSwitchToRecording, jump }: ConsultPaneProps) {
  const styles = useChatThreadStyles();
  const { t } = useTranslation();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const thread = useChatStore((s) => s.thread);
  // Measured height of the floating composer, reserved inside the thread.
  const [composerHeight, setComposerHeight] = useState(0);
  const categories = useCategoriesQuery();

  const consult = useConsultActions({
    onSent: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    categories: categories.data ?? [],
    onSwitchToRecording,
  });

  // Inverted list, same as the recording pane: offset 0 is "newest".
  const messages = useMemo(() => thread.filter((m) => isShown(m) && isConsultMessage(m)).reverse(), [thread]);
  const { highlightId, highlightOpacity, onScrollToIndexFailed } = useMessageJump(listRef, messages, jump);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
      // Newest first, so the message before this one is next in the array.
      const previous = messages[index + 1];
      const startsTurn = previous !== undefined && (item.role === "user" || previous.role === "assistant");
      const row = <ConsultMessageRow message={item} startsTurn={startsTurn} handlers={consult.handlers} />;
      // Messages grouped by day: the day's first one carries its date.
      return (
        <ChatRowFrame
          dayAt={dayStartAt(messages, index)}
          tint={CHAT_MODE_META.consult.tint}
          highlightOpacity={item.id === highlightId ? highlightOpacity : undefined}
        >
          {row}
        </ChatRowFrame>
      );
    },
    [messages, consult.handlers, highlightId, highlightOpacity],
  );

  return (
    // A tap anywhere but an answer's donut closes its slice's tooltip.
    <View style={consultStyles.pane} onTouchStart={clearDonutSelectionOnOutsideTouch}>
      <KeyboardLiftView>
        <ChatThreadList
          listRef={listRef}
          data={messages}
          keyExtractor={messageKey}
          // Each row spaces itself (ConsultMessageRow).
          contentContainerStyle={[styles.thread, consultStyles.thread]}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={onScrollToIndexFailed}
          reservedBottom={composerHeight}
          renderItem={renderItem}
          ListEmptyComponent={loading ? <ChatThreadSkeleton /> : <ConsultEmptyState />}
          ListHeaderComponent={
            consult.sending ? (
              <View style={[styles.typingRow, consultStyles.typing]}>
                <TypingIndicator label={t(ANSWERING_LABEL)} testID="typing-consult" />
              </View>
            ) : null
          }
        />

        <ConsultComposer
          sending={consult.sending}
          bottomInset={bottomInset}
          onSend={consult.sendConsult}
          onAsk={consult.askQuery}
          onHeightChange={setComposerHeight}
        />
      </KeyboardLiftView>
      {/* Built with the pane, after the composer, so the sheets paint over it. */}
      <IntentionSheetsHost />
    </View>
  );
}

interface ConsultComposerProps {
  sending: boolean;
  bottomInset: number;
  onSend: (text: string) => void;
  onAsk: ReturnType<typeof useConsultActions>["askQuery"];
  onHeightChange: (height: number) => void;
}

// Holds the draft, so typing re-renders the input and not the thread.
function ConsultComposer({ sending, bottomInset, onSend, onAsk, onHeightChange }: ConsultComposerProps) {
  const requireOnline = useRequireOnline();
  const [input, setInput] = useState("");

  return (
    <ChatComposer onHeightChange={onHeightChange}>
      <ChatInputBar
        value={input}
        onChangeText={setInput}
        // Online-only (AC-OFF-08): offline, the typed text stays in the box.
        onSend={() =>
          requireOnline(() => {
            const text = input;
            setInput("");
            onSend(text);
          })
        }
        sending={sending}
        bottomInset={bottomInset}
        mode="consult"
        quickActions={
          <StarterChipsRow onAsk={(query, label) => requireOnline(() => onAsk(query, label))} disabled={sending} />
        }
      />
    </ChatComposer>
  );
}

const consultStyles = StyleSheet.create({
  // The composer is positioned against this box.
  pane: { flex: 1 },
  thread: { gap: 0 },
  // The reply-to-be, so it sits as close to the question as the reply will.
  typing: { marginTop: spacing.sm },
});
