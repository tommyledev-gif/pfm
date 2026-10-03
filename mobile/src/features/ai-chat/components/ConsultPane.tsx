import { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatComposer } from "@/features/ai-chat/components/ChatComposer";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { ConsultMessageRow } from "@/features/ai-chat/components/ConsultMessageRow";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { useConsultActions } from "@/features/ai-chat/hooks/use-consult-actions";
import { ChatMessage } from "@/features/ai-chat/types";
import { StarterChipsRow } from "@/features/analytics/components/StarterChipsRow";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { spacing } from "@/lib/theme";
import { useChatStore } from "@/stores/chat-store";

interface ConsultPaneProps {
  keyboardVisible: boolean;
  keyboardHeight: number;
  bottomInset: number;
  /** `prefill` = the question to carry into the recording input. */
  onSwitchToRecording: (prefill?: string) => void;
}

/**
 * The "Hỏi phân tích" conversation (specs/ai-chat-query-spending): its own
 * thread, typing indicator, starter chips and input, rendered in place of
 * the recording pane. No swipe rows — answers are snapshots, never edited
 * or removed — so bubbles render directly.
 */
export function ConsultPane({
  keyboardVisible,
  keyboardHeight,
  bottomInset,
  onSwitchToRecording,
}: ConsultPaneProps) {
  const styles = useChatThreadStyles();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const thread = useChatStore((s) => s.thread);

  const [input, setInput] = useState("");
  // Measured height of the floating composer, reserved inside the thread.
  const [composerHeight, setComposerHeight] = useState(0);

  const categories = useCategoriesQuery();

  const consult = useConsultActions({
    onSent: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    categories: categories.data ?? [],
    onSwitchToRecording,
  });

  // Inverted list, same reasoning as the recording pane: offset 0 is "newest".
  const messages = useMemo(() => thread.filter(isConsultMessage).reverse(), [thread]);

  return (
    <View style={consultStyles.pane}>
      <ChatThreadList
        listRef={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        // Each row spaces itself (ConsultMessageRow) — a uniform gap is what
        // made every message sit the same distance from every other.
        contentContainerStyle={[styles.thread, consultStyles.thread]}
        keyboardShouldPersistTaps="handled"
        reservedBottom={composerHeight}
        renderItem={({ item, index }) => {
          // Newest first (inverted), so the message before this one is next.
          const previous = messages[index + 1];
          const startsTurn = previous !== undefined && (item.role === "user" || previous.role === "assistant");
          return <ConsultMessageRow message={item} startsTurn={startsTurn} handlers={consult.handlers} />;
        }}
        // No quoted example question here: it would look tappable and is
        // not — the real, tappable ones are the chips right above the input.
        ListEmptyComponent={<Text style={styles.hint}>Hỏi mình về chi tiêu của bạn, hoặc chọn một gợi ý bên dưới.</Text>}
        ListHeaderComponent={
          consult.sending ? (
            <View style={[styles.typingRow, consultStyles.typing]}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      <ChatComposer onHeightChange={setComposerHeight}>
        <ChatInputBar
          value={input}
          onChangeText={setInput}
          onSend={() => {
            const text = input;
            setInput("");
            consult.sendConsult(text);
          }}
          sending={consult.sending}
          keyboardVisible={keyboardVisible}
          keyboardHeight={keyboardHeight}
          bottomInset={bottomInset}
          mode="consult"
          quickActions={<StarterChipsRow onAsk={consult.askQuery} disabled={consult.sending} />}
        />
      </ChatComposer>
    </View>
  );
}

const consultStyles = StyleSheet.create({
  // The composer is positioned against this box.
  pane: { flex: 1 },
  thread: { gap: 0 },
  // The reply-to-be, so it sits as close to the question as the reply will.
  typing: { marginTop: spacing.sm },
});
