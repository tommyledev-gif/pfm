import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/components/shared/Screen";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatMessageRow } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatModeBackdrop } from "@/features/ai-chat/components/ChatModeBackdrop";
import { ChatModeHeader } from "@/features/ai-chat/components/ChatModeHeader";
import { ChatModePicker } from "@/features/ai-chat/components/ChatModePicker";
import { ChatThreadList } from "@/features/ai-chat/components/ChatThreadList";
import { ChatOverlays } from "@/features/ai-chat/components/ChatOverlays";
import { useChatThreadStyles } from "@/features/ai-chat/components/chat-thread-styles";
import { ConsultPane } from "@/features/ai-chat/components/ConsultPane";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { ChatMode, useChatModeStore } from "@/features/ai-chat/chat-mode";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { useChatOverlays } from "@/features/ai-chat/hooks/use-chat-overlays";
import { isTombstone } from "@/features/ai-chat/tombstone";
import { useKeyboardHeight, useKeyboardVisible } from "@/lib/use-keyboard-height";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useChatThreadQuery } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";

// A beat for the list to finish its mount/measure pass before scrolling to a
// deep-linked message, then a longer one to retry if the row still was not
// measured — onScrollToIndexFailed covers the miss, this avoids the stutter.
const FOCUS_SCROLL_DELAY_MS = 50;
const FOCUS_RETRY_DELAY_MS = 100;

export default function AiChatScreen() {
  const chatThreadStyles = useChatThreadStyles();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Thread lives in a store, not local state — this screen unmounts on every
  // bottom-nav tab change, which would otherwise lose the conversation.
  const thread = useChatStore((s) => s.thread);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const hydrateThread = useChatStore((s) => s.hydrateThread);

  // Which conversation is on screen — recording or analysis, each its own
  // pane. Stored outside the screen for the same unmount-on-tab-change
  // reason, but NOT persisted — see chat-mode.ts.
  const mode = useChatModeStore((s) => s.mode);
  const setMode = useChatModeStore((s) => s.setMode);
  const [modePickerOpen, setModePickerOpen] = useState(false);

  const [input, setInput] = useState("");
  // Bumped on any scroll or thread change, so a parked swipe row is never left
  // open over content that has moved underneath it.
  const [closeSignal, setCloseSignal] = useState(0);

  const keyboardHeight = useKeyboardHeight();
  // ⚠️ From the keyboard events, not from `keyboardHeight > 0`. The height is
  // what remains to pad AFTER the OS has resized the window, so on a device
  // that resizes it is legitimately 0 while the keyboard is wide open.
  const keyboardVisible = useKeyboardVisible();

  const overlays = useChatOverlays(keyboardVisible);

  const { focusMessageId, focusedAt, openEdit } = useLocalSearchParams<{
    focusMessageId?: string;
    focusedAt?: string;
    openEdit?: string;
  }>();

  // Restores the synced thread when the local copy is empty — i.e. after a
  // logout, reinstall or new device wiped it.
  //
  // ⚠️ Frozen at mount rather than read live. This screen unmounts on every
  // bottom-nav tab change, but the query's CACHED result does not go with it —
  // so on the next mount `threadQuery.data` still holds the thread as the
  // server had it at fetch time, and re-running the effect against it undid
  // every local change since (a deleted transaction's tombstone reverting to a
  // live card is how this showed up). The store refuses a hydrate over a
  // non-empty thread as well; this keeps the request from being made at all.
  const [needsServerThread] = useState(() => thread.length === 0);
  const threadQuery = useChatThreadQuery(needsServerThread && thread.length === 0);
  useEffect(() => {
    if (!needsServerThread) return;
    if (threadQuery.data?.length) hydrateThread(threadQuery.data);
  }, [needsServerThread, threadQuery.data, hydrateThread]);

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  // Read only, so an unconfirmed proposal can say what saving it would do to
  // the category's budget. The card never writes budgets.
  const budgets = useBudgetsQuery();

  const chat = useChatActions({
    onSent: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  });
  const removal = useTransactionRemoval();

  // Recording pane only — analysis messages live in ConsultPane. Reversed here
  // rather than in the store, so every other consumer keeps reading the
  // thread in natural order.
  const invertedThread = useMemo(() => thread.filter((m) => !isConsultMessage(m)).reverse(), [thread]);
  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  // Keyed "categoryId|currency": a budget carries a separate limit per
  // currency, and a proposal in one must never be measured against another.
  const budgetByCategoryCurrency = useMemo(() => {
    const map = new Map<string, { amount_limit: number; spent: number }>();
    for (const budget of budgets.data ?? []) {
      for (const limit of budget.limits) {
        map.set(`${budget.category_id}|${limit.currency}`, {
          amount_limit: limit.amount_limit,
          spent: limit.spent,
        });
      }
    }
    return map;
  }, [budgets.data]);

  useEffect(() => {
    setCloseSignal((n) => n + 1);
  }, [thread.length]);

  useEffect(() => {
    if (!focusMessageId) return;
    // Deep links always point at a Transaction proposal, which lives in the
    // recording pane.
    setMode("transaction");
    const index = invertedThread.findIndex((m) => m.id === focusMessageId);
    if (index === -1) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, FOCUS_SCROLL_DELAY_MS);
    if (openEdit === "1") {
      const message = thread.find((m) => m.id === focusMessageId);
      if (message?.action && !isTombstone(message)) overlays.setEditingActionMessage(message);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMessageId, focusedAt]);

  // Picking "Lập ngân sách" opens the wizard straight away; the mode lasts only
  // while it is open, and closing it returns to recording.
  const handleSelectMode = (next: ChatMode) => {
    setMode(next);
    setModePickerOpen(false);
    if (next === "budget") overlays.openBudgetWizard(null);
  };
  const handleCloseBudgetWizard = () => {
    overlays.setBudgetWizardOpen(false);
    if (mode === "budget") setMode("transaction");
  };

  return (
    <Screen>
      {/* Outside the content View so its wash runs up under the status bar too. */}
      <ChatModeBackdrop mode={mode} />
      <View style={styles.screen}>
        <ChatModeHeader mode={mode} onPressMode={() => setModePickerOpen(true)} />

        {mode === "consult" ? (
          <ConsultPane
            keyboardVisible={keyboardVisible}
            keyboardHeight={keyboardHeight}
            bottomInset={insets.bottom}
            onSwitchToRecording={() => setMode("transaction")}
          />
        ) : (
          <>
            <ChatThreadList
              listRef={listRef}
              data={invertedThread}
              keyExtractor={(m) => m.id}
              contentContainerStyle={chatThreadStyles.thread}
              // The default eats the first touch on any row below a focused
              // input, so a swipe silently did nothing while the keyboard was open.
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => setCloseSignal((n) => n + 1)}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
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
                  onTriggerEdit={overlays.triggerEdit}
                  onTriggerDelete={removal.request}
                  onPressHistory={overlays.openHistory}
                  onOpenBudgetWizard={(message) => overlays.openBudgetWizard(message.id)}
                  onOpenManualEntry={() => overlays.setManualEntryOpen(true)}
                />
              )}
              // No counter-transform on these: the list already composes its own
              // inversion onto the header/empty slots, so a second one would
              // render them upside down.
              ListEmptyComponent={
                <Text style={chatThreadStyles.hint}>
                  Cho mình biết bạn đã chi hay thu gì — vd: &ldquo;Cà phê 50k tiền mặt&rdquo; — mình sẽ soạn sẵn giao
                  dịch cho bạn.
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

            <ChatInputBar
              value={input}
              onChangeText={setInput}
              onSend={() => {
                const text = input;
                setInput("");
                void chat.send(text);
              }}
              sending={chat.sending}
              keyboardVisible={keyboardVisible}
              keyboardHeight={keyboardHeight}
              bottomInset={insets.bottom}
              onOpenBudgetWizard={() => overlays.openBudgetWizard(null)}
              // The real mode, not "transaction": while the budget wizard is
              // open the screen behind it takes the wizard's colour too.
              mode={mode}
            />
          </>
        )}
      </View>

      <ChatModePicker
        visible={modePickerOpen}
        mode={mode}
        onClose={() => setModePickerOpen(false)}
        onSelect={handleSelectMode}
      />

      <ChatOverlays
        walletById={walletById}
        categoryById={categoryById}
        removal={removal}
        editingMessage={overlays.editingMessage}
        editingActionMessage={overlays.editingActionMessage}
        historyMessage={overlays.historyMessage}
        tombstoneMessage={overlays.tombstoneMessage}
        manualEntryOpen={overlays.manualEntryOpen}
        budgetWizardOpen={overlays.budgetWizardOpen}
        onCloseEditingMessage={() => overlays.setEditingMessage(null)}
        onSaveEditingMessage={(text) => {
          const target = overlays.editingMessage;
          overlays.setEditingMessage(null);
          if (target) void chat.editUserMessage(target, text);
        }}
        onCloseEditingAction={() => overlays.setEditingActionMessage(null)}
        onSaveEditingAction={(payload) => {
          const target = overlays.editingActionMessage;
          overlays.setEditingActionMessage(null);
          if (target) chat.editAction(target, payload);
        }}
        onCloseHistory={() => overlays.setHistoryMessage(null)}
        onCloseTombstone={() => overlays.setTombstoneMessage(null)}
        onCloseManualEntry={() => overlays.setManualEntryOpen(false)}
        onCloseBudgetWizard={handleCloseBudgetWizard}
        onBudgetWizardCompleted={(createdCount) => {
          if (overlays.budgetWizardOriginMessageId) {
            updateMessage(overlays.budgetWizardOriginMessageId, {
              budgetWizardSubmitted: true,
              budgetWizardCreatedCount: createdCount,
            });
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // No background of its own — Screen paints bgApp, and ChatModeBackdrop
  // has to show through.
  screen: { flex: 1 },
});
