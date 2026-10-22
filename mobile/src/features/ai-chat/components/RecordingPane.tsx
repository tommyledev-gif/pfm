import { RefObject, useCallback, useMemo, useState } from "react";
import { FlatList, LayoutChangeEvent, ListRenderItemInfo, StyleSheet, View } from "react-native";

import { closeParkedSwipeRow } from "@/components/shared/use-swipe-actions";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatMessageRow } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { ChatThreadSkeleton } from "@/features/ai-chat/components/ChatThreadSkeleton";
import { KeyboardLiftView } from "@/features/ai-chat/components/KeyboardLiftView";
import { RecordingComposer } from "@/features/ai-chat/components/RecordingComposer";
import { RecordingEmptyState } from "@/features/ai-chat/components/RecordingEmptyState";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { ChatDraftStore } from "@/features/ai-chat/chat-draft";
import { ChatMode } from "@/features/ai-chat/chat-mode";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { ChatMessage } from "@/features/ai-chat/types";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Category } from "@/features/categories/types";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";
import { useRequireOnline } from "@/lib/connectivity";
import { PROPOSAL_CURRENCY } from "@/lib/constants";
import { useLatestCallback } from "@/lib/use-latest-callback";

// Retry delay when a deep-linked row had not been measured yet.
const FOCUS_RETRY_DELAY_MS = 100;

const messageKey = (m: ChatMessage) => m.id;

// What the assistant is reading: the newest user message, sent or re-sent.
const READING_PHOTO = "Đang đọc ảnh…";
const READING_MESSAGE = "Đang đọc tin nhắn…";
const readingLabel = (messages: ChatMessage[]) =>
  messages.find((m) => m.role === "user")?.imageCapture ? READING_PHOTO : READING_MESSAGE;

interface RecordingPaneProps {
  listRef: RefObject<FlatList<ChatMessage> | null>;
  /** Recording messages, newest first (the list is inverted). */
  messages: ChatMessage[];
  /** The saved thread is still being read back: a skeleton, not the empty state. */
  loading: boolean;
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  chat: ReturnType<typeof useChatActions>;
  draftStore: ChatDraftStore;
  /** Focus the input on mount — set when arriving from analysis mode. */
  autoFocusInput: boolean;
  onInputFocused: () => void;
  bottomInset: number;
  mode: ChatMode;
  onTriggerEdit: (message: ChatMessage) => void;
  onTriggerDelete: (message: ChatMessage) => void;
  onPressHistory: (message: ChatMessage) => void;
  onOpenBudgetWizard: (originMessageId: string | null) => void;
  onOpenManualEntry: () => void;
}

/**
 * The "Ghi giao dịch" conversation: the thread, the typing indicator and the
 * floating composer (RecordingComposer, which owns the input).
 */
export function RecordingPane({
  listRef,
  messages,
  loading,
  walletById,
  categoryById,
  chat,
  draftStore,
  autoFocusInput,
  onInputFocused,
  bottomInset,
  mode,
  onTriggerEdit,
  onTriggerDelete,
  onPressHistory,
  onOpenBudgetWizard,
  onOpenManualEntry,
}: RecordingPaneProps) {
  const chatThreadStyles = useChatThreadStyles();
  const requireOnline = useRequireOnline();
  const [composerHeight, setComposerHeight] = useState(0);
  const [paneHeight, setPaneHeight] = useState(0);

  // Read only, so an unconfirmed proposal can say what saving it would do to
  // the category's budget.
  const budgets = useBudgetsQuery();
  // Without a VND Wallet a proposal can never be saved, so its card offers to
  // create one. Only once the list has loaded, so it never flashes.
  const wallets = useWalletsQuery("writable");
  const noVndWallet = wallets.isSuccess && !wallets.data.some((w) => w.currency === PROPOSAL_CURRENCY);
  const openWalletCreator = useOpenWalletCreator();
  const handleCreateWallet = noVndWallet ? openWalletCreator : undefined;

  // Keyed "categoryId|currency": a budget carries a separate limit per currency.
  const budgetByCategoryCurrency = useMemo(() => {
    const map = new Map<string, { amount_limit: number; spent: number }>();
    for (const budget of budgets.data ?? []) {
      for (const limit of budget.limits) {
        map.set(`${budget.category_id}|${limit.currency}`, { amount_limit: limit.amount_limit, spent: limit.spent });
      }
    }
    return map;
  }, [budgets.data]);

  // Stable identities, so a memoized row re-renders only when its own message
  // (or its confirming flag) changes.
  const handleConfirm = useLatestCallback((message: ChatMessage) => requireOnline(() => chat.confirmAction(message)));
  const handleTriggerEdit = useLatestCallback(onTriggerEdit);
  const handleTriggerDelete = useLatestCallback(onTriggerDelete);
  const handlePressHistory = useLatestCallback(onPressHistory);
  const handleOpenWizard = useLatestCallback((message: ChatMessage) => onOpenBudgetWizard(message.id));
  const handleOpenManualEntry = useLatestCallback(onOpenManualEntry);
  const handleRetryImage = useLatestCallback((message: ChatMessage) => void chat.retryImage(message));
  // Offline, a retry would only fail the same way again: the connection
  // toast shows instead, and the button stays for when it is back.
  const handleRetryText = useLatestCallback((message: ChatMessage) => requireOnline(() => void chat.retryReply(message)));
  const confirmingId = chat.confirmingId;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => (
      <ChatMessageRow
        message={item}
        walletById={walletById}
        categoryById={categoryById}
        budgetByCategoryCurrency={budgetByCategoryCurrency}
        confirming={confirmingId === item.id}
        onConfirm={handleConfirm}
        onTriggerEdit={handleTriggerEdit}
        onTriggerDelete={handleTriggerDelete}
        onPressHistory={handlePressHistory}
        onOpenBudgetWizard={handleOpenWizard}
        onOpenManualEntry={handleOpenManualEntry}
        onRetryImage={handleRetryImage}
        onRetryText={handleRetryText}
        onCreateWallet={handleCreateWallet}
        onOpenWalletCreator={openWalletCreator}
      />
    ),
    [
      walletById,
      categoryById,
      budgetByCategoryCurrency,
      confirmingId,
      handleConfirm,
      handleTriggerEdit,
      handleTriggerDelete,
      handlePressHistory,
      handleOpenWizard,
      handleOpenManualEntry,
      handleRetryImage,
      handleRetryText,
      handleCreateWallet,
      openWalletCreator,
    ],
  );

  return (
    <View style={styles.pane} onLayout={(e: LayoutChangeEvent) => setPaneHeight(e.nativeEvent.layout.height)}>
      <KeyboardLiftView>
        <ChatThreadList
          listRef={listRef}
          data={messages}
          keyExtractor={messageKey}
          contentContainerStyle={chatThreadStyles.thread}
          reservedBottom={composerHeight}
          // The default eats the first touch on any row below a focused input.
          keyboardShouldPersistTaps="handled"
          // A parked swipe row is never left open over content moving under it.
          onScrollBeginDrag={closeParkedSwipeRow}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, FOCUS_RETRY_DELAY_MS);
          }}
          renderItem={renderItem}
          // No counter-transform: the list composes its own inversion onto these.
          ListEmptyComponent={
            loading ? <ChatThreadSkeleton /> : <RecordingEmptyState onPickExample={draftStore.getState().setText} />
          }
          // Header renders at the visual bottom of an inverted list.
          ListHeaderComponent={
            chat.sending ? (
              <View style={chatThreadStyles.typingRow}>
                <TypingIndicator label={readingLabel(messages)} testID="typing-recording" />
              </View>
            ) : null
          }
        />

        <RecordingComposer
          draftStore={draftStore}
          chat={chat}
          mode={mode}
          bottomInset={bottomInset}
          paneHeight={paneHeight}
          autoFocusInput={autoFocusInput}
          onInputFocused={onInputFocused}
          onOpenBudgetWizard={onOpenBudgetWizard}
          onHeightChange={setComposerHeight}
        />
      </KeyboardLiftView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The composer is positioned against this box.
  pane: { flex: 1 },
});
