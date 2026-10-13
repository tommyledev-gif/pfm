import { RefObject, useCallback, useMemo, useState } from "react";
import { FlatList, Keyboard, LayoutChangeEvent, ListRenderItemInfo, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { onlineManager } from "@tanstack/react-query";

import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatComposer } from "@/features/ai-chat/components/ChatComposer";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatMessageRow } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { KeyboardLiftView } from "@/features/ai-chat/components/KeyboardLiftView";
import { OfflineManualEntryDialog } from "@/features/ai-chat/components/OfflineManualEntryDialog";
import { draftFromText } from "@/features/transactions/draft-from-text";
import { useManualDraftStore } from "@/features/transactions/manual-draft-store";
import { PhraseSuggestions } from "@/features/ai-chat/components/PhraseSuggestions";
import { RecordingEmptyState } from "@/features/ai-chat/components/RecordingEmptyState";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { ChatMode } from "@/features/ai-chat/chat-mode";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { usePhraseSuggestions } from "@/features/ai-chat/hooks/use-phrase-suggestions";
import { ChatMessage } from "@/features/ai-chat/types";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Category } from "@/features/categories/types";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";
import { useRequireOnline } from "@/lib/connectivity";
import { PROPOSAL_CURRENCY } from "@/lib/constants";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useCurrentUserId } from "@/stores/use-current-user-id";

// The suggestion area may take at most this share of the pane's height.
const SUGGESTION_MAX_HEIGHT_RATIO = 0.2;
// Retry delay when a deep-linked row had not been measured yet.
const FOCUS_RETRY_DELAY_MS = 100;

const messageKey = (m: ChatMessage) => m.id;

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
  const requireOnline = useRequireOnline();
  const router = useRouter();
  const openDraft = useManualDraftStore((s) => s.openDraft);
  const [composerHeight, setComposerHeight] = useState(0);
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);
  const [paneHeight, setPaneHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  // Read only, so an unconfirmed proposal can say what saving it would do to
  // the category's budget. The card never writes budgets.
  const budgets = useBudgetsQuery();
  const suggestions = usePhraseSuggestions(input, userId);
  // Proposals are read as VND (proposal-wallet.ts), so without a VND Wallet a
  // card can never be saved — it offers to create one instead. Only once the
  // list has loaded, so it never flashes for an account that has one.
  const wallets = useWalletsQuery();
  const noVndWallet = wallets.isSuccess && !wallets.data.some((w) => w.currency === PROPOSAL_CURRENCY);
  const openWalletCreator = useOpenWalletCreator();
  const handleCreateWallet = noVndWallet ? openWalletCreator : undefined;

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

  // Offline the AI cannot read the message, but the manual form can still
  // record it (into the offline queue) — offered instead of a dead-end toast.
  // Connectivity is read at press time, like useRequireOnline does.
  const handleSend = () => {
    if (!onlineManager.isOnline()) {
      // The dialog is a Modal: closing the keyboard first is what brings the
      // input bar down under it (see KeyboardLiftView).
      Keyboard.dismiss();
      setOfflineDialogOpen(true);
      return;
    }
    const text = input;
    onChangeInput("");
    void chat.send(text);
  };
  const handleManualEntry = () => {
    setOfflineDialogOpen(false);
    openDraft(draftFromText(input));
    onChangeInput("");
    Keyboard.dismiss();
    router.navigate("/transactions");
  };

  // Stable identities, so a memoized ChatMessageRow re-renders only when its
  // own message (or its confirming flag) changes — not on every keystroke in
  // the input, nor for every row when one card is confirmed. That re-render
  // storm is what held the JS thread and made a tapped Confirm look dead.
  const handleConfirm = useLatestCallback((message: ChatMessage) => requireOnline(() => chat.confirmAction(message)));
  const handleTriggerEdit = useLatestCallback(onTriggerEdit);
  const handleTriggerDelete = useLatestCallback(onTriggerDelete);
  const handlePressHistory = useLatestCallback(onPressHistory);
  const handleOpenWizard = useLatestCallback((message: ChatMessage) => onOpenBudgetWizard(message.id));
  const handleOpenManualEntry = useLatestCallback(onOpenManualEntry);
  const confirmingId = chat.confirmingId;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => (
      <ChatMessageRow
        message={item}
        walletById={walletById}
        categoryById={categoryById}
        budgetByCategoryCurrency={budgetByCategoryCurrency}
        confirming={confirmingId === item.id}
        closeSignal={closeSignal}
        onConfirm={handleConfirm}
        onTriggerEdit={handleTriggerEdit}
        onTriggerDelete={handleTriggerDelete}
        onPressHistory={handlePressHistory}
        onOpenBudgetWizard={handleOpenWizard}
        onOpenManualEntry={handleOpenManualEntry}
        onCreateWallet={handleCreateWallet}
        onOpenWalletCreator={openWalletCreator}
      />
    ),
    [
      walletById,
      categoryById,
      budgetByCategoryCurrency,
      confirmingId,
      closeSignal,
      handleConfirm,
      handleTriggerEdit,
      handleTriggerDelete,
      handlePressHistory,
      handleOpenWizard,
      handleOpenManualEntry,
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
          // The default eats the first touch on any row below a focused
          // input, so a swipe silently did nothing while the keyboard was open.
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, FOCUS_RETRY_DELAY_MS);
          }}
          renderItem={renderItem}
          // No counter-transform on these: the list already composes its own
          // inversion onto the header/empty slots.
          ListEmptyComponent={<RecordingEmptyState onPickExample={onChangeInput} />}
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
            // Offline, the typed text stays in the box until the User picks
            // manual entry (AC-OFF-08).
            onSend={handleSend}
            sending={chat.sending}
            keyboardVisible={keyboardVisible}
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
      </KeyboardLiftView>
      <OfflineManualEntryDialog
        visible={offlineDialogOpen}
        onConfirm={handleManualEntry}
        onCancel={() => setOfflineDialogOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The composer is positioned against this box.
  pane: { flex: 1 },
});
