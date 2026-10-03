import { RefObject, useMemo, useState } from "react";
import { FlatList, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatComposer } from "@/features/ai-chat/components/ChatComposer";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatMessageRow } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { PhraseSuggestions } from "@/features/ai-chat/components/PhraseSuggestions";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { ChatMode } from "@/features/ai-chat/chat-mode";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { usePhraseSuggestions } from "@/features/ai-chat/hooks/use-phrase-suggestions";
import { ChatMessage } from "@/features/ai-chat/types";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { useCurrentUserId } from "@/stores/use-current-user-id";

// The suggestion area may take at most this share of the pane's height.
const SUGGESTION_MAX_HEIGHT_RATIO = 0.2;
// Retry delay when a deep-linked row had not been measured yet.
const FOCUS_RETRY_DELAY_MS = 100;

interface RecordingPaneProps {
  listRef: RefObject<FlatList<ChatMessage> | null>;
  /** Recording messages, newest first (the list is inverted). */
  messages: ChatMessage[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  chat: ReturnType<typeof useChatActions>;
  closeSignal: number;
  onScrollBeginDrag: () => void;
  input: string;
  onChangeInput: (text: string) => void;
  /** Focus the input on mount — set when arriving from analysis mode. */
  autoFocusInput: boolean;
  onInputFocused: () => void;
  keyboardVisible: boolean;
  keyboardHeight: number;
  bottomInset: number;
  mode: ChatMode;
  onTriggerEdit: (message: ChatMessage) => void;
  onTriggerDelete: (message: ChatMessage) => void;
  onPressHistory: (message: ChatMessage) => void;
  onOpenBudgetWizard: (originMessageId: string | null) => void;
  onOpenManualEntry: () => void;
}

/**
 * The "Ghi giao dịch" conversation: thread, typing indicator, and a floating
 * composer (phrase suggestions, quick chip, input). Split out of the screen,
 * mirroring ConsultPane, so each pane owns its own layout.
 */
export function RecordingPane({
  listRef,
  messages,
  walletById,
  categoryById,
  chat,
  closeSignal,
  onScrollBeginDrag,
  input,
  onChangeInput,
  autoFocusInput,
  onInputFocused,
  keyboardVisible,
  keyboardHeight,
  bottomInset,
  mode,
  onTriggerEdit,
  onTriggerDelete,
  onPressHistory,
  onOpenBudgetWizard,
  onOpenManualEntry,
}: RecordingPaneProps) {
  const chatThreadStyles = useChatThreadStyles();
  const userId = useCurrentUserId();
  const [composerHeight, setComposerHeight] = useState(0);
  const [paneHeight, setPaneHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  // Read only, so an unconfirmed proposal can say what saving it would do to
  // the category's budget. The card never writes budgets.
  const budgets = useBudgetsQuery();
  const suggestions = usePhraseSuggestions(input, userId);

  // Keyed "categoryId|currency": a budget carries a separate limit per
  // currency, and a proposal in one must never be measured against another.
  const budgetByCategoryCurrency = useMemo(() => {
    const map = new Map<string, { amount_limit: number; spent: number }>();
    for (const budget of budgets.data ?? []) {
      for (const limit of budget.limits) {
        map.set(`${budget.category_id}|${limit.currency}`, { amount_limit: limit.amount_limit, spent: limit.spent });
      }
    }
    return map;
  }, [budgets.data]);

  const handleFocusChange = (focused: boolean) => {
    setInputFocused(focused);
    if (focused) onInputFocused();
  };

  return (
    <View style={styles.pane} onLayout={(e: LayoutChangeEvent) => setPaneHeight(e.nativeEvent.layout.height)}>
      <ChatThreadList
        listRef={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={chatThreadStyles.thread}
        reservedBottom={composerHeight}
        // The default eats the first touch on any row below a focused
        // input, so a swipe silently did nothing while the keyboard was open.
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
          }, FOCUS_RETRY_DELAY_MS);
        }}
        renderItem={({ item }) => (
          <ChatMessageRow
            message={item}
            walletById={walletById}
            categoryById={categoryById}
            budgetByCategoryCurrency={budgetByCategoryCurrency}
            confirming={chat.confirmingId === item.id}
            closeSignal={closeSignal}
            onConfirm={chat.confirmAction}
            onTriggerEdit={onTriggerEdit}
            onTriggerDelete={onTriggerDelete}
            onPressHistory={onPressHistory}
            onOpenBudgetWizard={(message) => onOpenBudgetWizard(message.id)}
            onOpenManualEntry={onOpenManualEntry}
          />
        )}
        // No counter-transform on these: the list already composes its own
        // inversion onto the header/empty slots.
        ListEmptyComponent={
          <Text style={chatThreadStyles.hint}>
            Cho mình biết bạn đã chi hay thu gì — vd: &ldquo;Cà phê 50k tiền mặt&rdquo; — mình sẽ soạn sẵn giao dịch
            cho bạn.
          </Text>
        }
        // Header, not footer: on an inverted list the header renders at the
        // visual bottom, which is where the typing dots belong.
        ListHeaderComponent={
          chat.sending ? (
            <View style={chatThreadStyles.typingRow}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      <ChatComposer onHeightChange={setComposerHeight}>
        <ChatInputBar
          value={input}
          onChangeText={onChangeInput}
          onSend={() => {
            const text = input;
            onChangeInput("");
            void chat.send(text);
          }}
          sending={chat.sending}
          keyboardVisible={keyboardVisible}
          keyboardHeight={keyboardHeight}
          bottomInset={bottomInset}
          onOpenBudgetWizard={() => onOpenBudgetWizard(null)}
          // The real mode, not "transaction": while the budget wizard is
          // open the screen behind it takes the wizard's colour too.
          mode={mode}
          autoFocus={autoFocusInput}
          onFocusChange={handleFocusChange}
          aboveInput={
            inputFocused ? (
              <PhraseSuggestions
                suggestions={suggestions}
                // Of the part of the pane the keyboard does not cover.
                maxHeight={Math.max(0, paneHeight - keyboardHeight) * SUGGESTION_MAX_HEIGHT_RATIO}
                onSelect={onChangeInput}
              />
            ) : null
          }
        />
      </ChatComposer>
    </View>
  );
}

const styles = StyleSheet.create({
  // The composer is positioned against this box.
  pane: { flex: 1 },
});
