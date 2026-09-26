import { useMemo, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { chatThreadStyles as styles } from "@/features/ai-chat/components/chat-thread-styles";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { useConsultActions } from "@/features/ai-chat/hooks/use-consult-actions";
import { ChatMessage } from "@/features/ai-chat/types";
import { ConsultReplyCard } from "@/features/analytics/components/ConsultReplyCard";
import { StarterChipsRow } from "@/features/analytics/components/StarterChipsRow";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useChatStore } from "@/stores/chat-store";

interface ConsultPaneProps {
  keyboardVisible: boolean;
  keyboardHeight: number;
  bottomInset: number;
  onSwitchToRecording: () => void;
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
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const thread = useChatStore((s) => s.thread);

  const [input, setInput] = useState("");

  const categories = useCategoriesQuery();

  const consult = useConsultActions({
    onSent: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    categories: categories.data ?? [],
    onSwitchToRecording,
  });

  // Inverted list, same reasoning as the recording pane: offset 0 is "newest".
  const messages = useMemo(() => thread.filter(isConsultMessage).reverse(), [thread]);

  return (
    <>
      <ChatThreadList
        listRef={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ChatBubble role={item.role} text={item.text}>
            {item.consult ? <ConsultReplyCard data={item.consult} handlers={consult.handlers} /> : null}
          </ChatBubble>
        )}
        ListEmptyComponent={
          <Text style={styles.hint}>
            Hỏi mình về chi tiêu của bạn — vd: &ldquo;Tháng này tiêu bao nhiêu?&rdquo; — hoặc chọn một gợi ý bên dưới.
          </Text>
        }
        ListHeaderComponent={
          consult.sending ? (
            <View style={styles.typingRow}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

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
    </>
  );
}
