import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SparkleIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ChatMessageRow } from "@/features/ai-chat/components/ChatMessageRow";
import { ChatOverlays } from "@/features/ai-chat/components/ChatOverlays";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { isEditLocked } from "@/features/ai-chat/edit-lock";
import { isTombstone } from "@/features/ai-chat/tombstone";
import { colors, spacing, typography } from "@/lib/theme";
import { useKeyboardHeight, useKeyboardVisible } from "@/lib/use-keyboard-height";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useChatThreadQuery } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";

// Gives the input bar's margin time to settle back to its closed-keyboard
// value before a modal opens on top of it, so the sheet does not visibly jump
// as the keyboard closes.
const KEYBOARD_DISMISS_SETTLE_MS = 280;
// A beat for the list to finish its mount/measure pass before scrolling to a
// deep-linked message, then a longer one to retry if the row still was not
// measured — onScrollToIndexFailed covers the miss, this avoids the stutter.
const FOCUS_SCROLL_DELAY_MS = 50;
const FOCUS_RETRY_DELAY_MS = 100;

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Thread lives in a store, not local state — this screen unmounts on every
  // bottom-nav tab change, which would otherwise lose the conversation.
  const thread = useChatStore((s) => s.thread);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const hydrateThread = useChatStore((s) => s.hydrateThread);

  const [input, setInput] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  // A plain bubble opens a text editor; any transaction proposal opens the
  // structured form (editAction decides whether that patches a real
  // transaction or only the unconfirmed proposal).
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingActionMessage, setEditingActionMessage] = useState<ChatMessage | null>(null);
  const [historyMessage, setHistoryMessage] = useState<ChatMessage | null>(null);
  // A removed proposal opens the full transaction history sheet rather than
  // the proposal-only edit trail — see TransactionHistoryDrawer.
  const [tombstoneMessage, setTombstoneMessage] = useState<ChatMessage | null>(null);
  // Bumped on any scroll or thread change, so a parked swipe row is never left
  // open over content that has moved underneath it.
  const [closeSignal, setCloseSignal] = useState(0);
  const [budgetWizardOpen, setBudgetWizardOpen] = useState(false);
  const [budgetWizardOriginMessageId, setBudgetWizardOriginMessageId] = useState<string | null>(null);

  const keyboardHeight = useKeyboardHeight();
  // ⚠️ From the keyboard events, not from `keyboardHeight > 0`. The height is
  // what remains to pad AFTER the OS has resized the window, so on a device
  // that resizes it is legitimately 0 while the keyboard is wide open.
  const keyboardVisible = useKeyboardVisible();

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

  // Reversed here rather than in the store, so every other consumer keeps
  // reading the thread in natural order.
  const invertedThread = useMemo(() => [...thread].reverse(), [thread]);
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
    const index = invertedThread.findIndex((m) => m.id === focusMessageId);
    if (index === -1) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, FOCUS_SCROLL_DELAY_MS);
    if (openEdit === "1") {
      const message = thread.find((m) => m.id === focusMessageId);
      if (message?.action && !isTombstone(message)) setEditingActionMessage(message);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMessageId, focusedAt]);

  const openHistory = (message: ChatMessage) => {
    if (isTombstone(message)) setTombstoneMessage(message);
    else setHistoryMessage(message);
  };

  const openEditTarget = (item: ChatMessage) => {
    if (isEditLocked(item)) return;
    if (item.action) setEditingActionMessage(item);
    else setEditingMessage(item);
  };

  // If the keyboard is open while the user swipes a bubble above it, dismiss
  // it first and let the input bar settle before the modal opens on top —
  // otherwise the sheet visibly jumps as the keyboard closes underneath it.
  const handleEditTrigger = (item: ChatMessage) => {
    if (keyboardVisible) {
      Keyboard.dismiss();
      setTimeout(() => openEditTarget(item), KEYBOARD_DISMISS_SETTLE_MS);
    } else {
      openEditTarget(item);
    }
  };

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.header}>
          <SparkleIcon size={20} />
          <Text style={styles.headerTitle}>Budgest AI</Text>
        </View>

        <FlatList
          ref={listRef}
          // Inverted, so "the bottom" is scroll offset 0 — a fixed point
          // needing no measurement. Chasing the bottom with scrollToEnd never
          // held: FlatList estimates content height from the rows it has
          // measured, and the viewport keeps changing under it (insets resolve
          // a frame after mount, a bubble carrying an action card grows in a
          // later pass). Inverting deletes the problem instead of papering
          // over it.
          inverted
          style={styles.list}
          data={invertedThread}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.thread}
          // The default eats the first touch on any row below a focused
          // input, so a swipe silently did nothing while the keyboard was open.
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => setCloseSignal((n) => n + 1)}
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
              onTriggerEdit={handleEditTrigger}
              onTriggerDelete={removal.request}
              onPressHistory={openHistory}
              onOpenBudgetWizard={(message) => {
                setBudgetWizardOriginMessageId(message.id);
                setBudgetWizardOpen(true);
              }}
              onOpenManualEntry={() => setManualEntryOpen(true)}
            />
          )}
          // No counter-transform on these: the list already composes its own
          // inversion onto the header/empty slots, so a second one would
          // render them upside down.
          ListEmptyComponent={
            <Text style={styles.hint}>
              Cho mình biết bạn đã chi hay thu gì — vd: &ldquo;Cà phê 50k tiền mặt&rdquo; — mình sẽ soạn sẵn giao dịch
              cho bạn.
            </Text>
          }
          // Header, not footer: on an inverted list the header renders at the
          // visual bottom, which is where the typing dots belong.
          ListHeaderComponent={
            chat.sending ? (
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
            void chat.send(text);
          }}
          sending={chat.sending}
          keyboardVisible={keyboardVisible}
          keyboardHeight={keyboardHeight}
          bottomInset={insets.bottom}
          onOpenBudgetWizard={() => {
            setBudgetWizardOriginMessageId(null);
            setBudgetWizardOpen(true);
          }}
        />
      </View>

      <ChatOverlays
        walletById={walletById}
        categoryById={categoryById}
        removal={removal}
        editingMessage={editingMessage}
        editingActionMessage={editingActionMessage}
        historyMessage={historyMessage}
        tombstoneMessage={tombstoneMessage}
        manualEntryOpen={manualEntryOpen}
        budgetWizardOpen={budgetWizardOpen}
        onCloseEditingMessage={() => setEditingMessage(null)}
        onSaveEditingMessage={(text) => {
          const target = editingMessage;
          setEditingMessage(null);
          if (target) void chat.editUserMessage(target, text);
        }}
        onCloseEditingAction={() => setEditingActionMessage(null)}
        onSaveEditingAction={(payload) => {
          const target = editingActionMessage;
          setEditingActionMessage(null);
          if (target) chat.editAction(target, payload);
        }}
        onCloseHistory={() => setHistoryMessage(null)}
        onCloseTombstone={() => setTombstoneMessage(null)}
        onCloseManualEntry={() => setManualEntryOpen(false)}
        onCloseBudgetWizard={() => setBudgetWizardOpen(false)}
        onBudgetWizardCompleted={(createdCount) => {
          if (budgetWizardOriginMessageId) {
            updateMessage(budgetWizardOriginMessageId, {
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
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary },
  list: { flex: 1 },
  // paddingVertical, not paddingBottom: `inverted` mirrors the content
  // container, so a bottom-only pad would end up above the oldest message
  // instead of below the newest one.
  thread: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  hint: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  typingRow: { alignItems: "flex-start" },
});
