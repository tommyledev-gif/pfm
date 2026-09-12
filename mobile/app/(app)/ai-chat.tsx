import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { BudgetWizardCard } from "@/features/ai-chat/components/BudgetWizardCard";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { EditHistoryDialog } from "@/features/ai-chat/components/EditHistoryDialog";
import { EditMessageModal } from "@/features/ai-chat/components/EditMessageModal";
import { EditTransactionModal } from "@/features/ai-chat/components/EditTransactionModal";
import { SwipeableMessageRow } from "@/features/ai-chat/components/SwipeableMessageRow";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { BudgetWizardModal } from "@/features/budget-wizard/components/BudgetWizardModal";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { useChatThreadQuery } from "@/features/ai-chat/api/use-chat-thread-sync";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { ChatMessage, EditHistoryEntry, TransactionActionPayload } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";
import { useToastStore } from "@/stores/toast-store";

// A per-session counter would collide with ids from a previous session now
// that chat-store.ts persists the thread to disk (e.g. a fresh "msg_1" after
// restart could match an already-persisted message's id).
let idCounter = 0;
const nextId = () => `msg_${Date.now()}_${++idCounter}`;

// A manually-edited proposal never went through the AI Service, so it needs
// its own idempotency_key (the backend requires a real UUID — see
// backend/internal/dto/transaction_request.go). Not crypto-grade — this is
// a dedupe key, not a security token, same reasoning as nextId() above.
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Design's typing indicator is meant to be felt, not just a technicality —
// README: "typing indicator (~1.3s)" — so even a fast API response holds the
// dots for a beat before the reply appears.
const MIN_TYPING_MS = 1300;

// Gives the input bar's margin time to settle back to its closed-keyboard
// value (see useKeyboardHeight's hide-event handler) before a modal opens
// on top of it, so the sheet doesn't visibly jump as the keyboard closes.
const KEYBOARD_DISMISS_SETTLE_MS = 280;

// BottomNav (components/shared/BottomNav.tsx) sits flush at insets.bottom,
// standing 64px tall, with its active-tab ball floating another 24px above
// that — this is how far above the screen's bottom edge (on top of
// insets.bottom) the input bar's own bottom must sit to clear the ball when
// the keyboard is closed.
const NAV_CLEARANCE = 104;

// Small gap between the input bar and the top of the keyboard once open.
const KEYBOARD_GAP = spacing.sm;

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // Thread lives in a Zustand store (chat-store.ts), not local state — this
  // screen unmounts every time a bottom-nav tab is tapped, and local state
  // would lose the whole conversation on every navigation.
  const thread = useChatStore((s) => s.thread);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const hydrateThread = useChatStore((s) => s.hydrateThread);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  // A plain chat bubble (user text, or an actionless assistant reply) opens
  // a text editor; any transaction proposal — confirmed or not — opens the
  // structured form directly (editAction below decides whether that PATCHes
  // a real Transaction or just mutates the still-unconfirmed proposal).
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingActionMessage, setEditingActionMessage] = useState<ChatMessage | null>(null);
  const [historyMessage, setHistoryMessage] = useState<ChatMessage | null>(null);
  // F-13 AI Budget Setup Wizard (specs/ai-budget-wizard) — budgetWizardOriginMessageId
  // is null for the quick-action-chip entry point (US-01) and set to the
  // tapped card's id for the chat-trigger entry point (US-02), so onCompleted
  // knows which card (if any) to flip into its read-only "submitted" state.
  const [budgetWizardOpen, setBudgetWizardOpen] = useState(false);
  const [budgetWizardOriginMessageId, setBudgetWizardOriginMessageId] = useState<string | null>(null);
  // Drives the input bar's own margin directly off the measured keyboard
  // height — see use-keyboard-height.ts for why this isn't
  // KeyboardAvoidingView. BottomNav (app/(app)/_layout.tsx) hides itself on
  // the same signal, so the input only needs nav clearance while it's closed.
  const keyboardHeight = useKeyboardHeight();
  const keyboardVisible = keyboardHeight > 0;

  // Restores the synced thread from the server exactly once, only when the
  // local (AsyncStorage-persisted) thread is empty — i.e. after a logout,
  // reinstall, or new device wiped it (chat-store.ts's own debounced
  // autosave is what put it on the server in the first place). Once
  // hydrateThread sets a non-empty thread, `enabled` flips false and this
  // never refetches for the rest of the session.
  const threadQuery = useChatThreadQuery(thread.length === 0);
  useEffect(() => {
    if (threadQuery.data?.length) hydrateThread(threadQuery.data);
  }, [threadQuery.data, hydrateThread]);

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const sendMessage = useSendChatMessageMutation();
  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();

  // The list renders inverted (see the FlatList below), so the newest message
  // has to come first in the data. Reversed here rather than in chat-store so
  // every other consumer of the thread — the autosave, the edit lookups —
  // keeps reading it in natural order.
  const invertedThread = useMemo(() => [...thread].reverse(), [thread]);

  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  // Shared by both a fresh send and a resend-after-editing-the-user-message
  // flow — same typing-indicator pacing either way, only the resulting
  // message's `edited` flag differs. On failure, a rate-limit or
  // AI-service-unavailable response gets its own distinct copy plus a
  // manual-entry offer — both already exist server-side (AIChatRateLimiter,
  // ErrAIServiceUnavailable) and are distinguishable by error_code — instead
  // of the generic "couldn't process that" text every other failure gets.
  const requestAssistantReply = async (message: string, edited?: boolean): Promise<ChatMessage> => {
    const startedAt = Date.now();
    try {
      const response = await sendMessage.mutateAsync({ message });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
      }
      const action = response.actions[0];
      return {
        id: nextId(),
        role: "assistant",
        text: response.message,
        action,
        intent: response.intent === "ambiguous" ? "ambiguous" : undefined,
        actionType: response.action_type,
        edited,
        editHistory: action ? [{ payload: action.payload, timestamp: Date.now(), source: "created" }] : undefined,
      };
    } catch (err) {
      const code = getErrorCode(err);
      const isBusy = code === "RATE_LIMITED" || code === "AI_SERVICE_UNAVAILABLE";
      return {
        id: nextId(),
        role: "assistant",
        text: isBusy
          ? "Hệ thống đang bận, vui lòng thử lại sau."
          : "Xin lỗi, mình chưa xử lý được. Vui lòng thử lại.",
        offerManualEntry: isBusy,
        edited,
      };
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addMessage({ id: nextId(), role: "user", text });
    // Offset 0 is the newest message on an inverted list — exact, no
    // measurement. Only needed for the case where the user had scrolled up
    // into history before sending; otherwise they are already there.
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setSending(true);
    addMessage(await requestAssistantReply(text));
    setSending(false);
  };

  // Editing a user message patches its text in place (the bubble itself
  // just shows the correction, same as any chat app's "edited" message) but
  // re-runs extraction on the corrected text rather than silently leaving
  // the old AI reply attached to now-stale input — the new reply is pushed
  // to the end of the thread instead of replacing the old one, so nothing
  // in the visible history is ever destroyed. If the reply immediately
  // after it was an unconfirmed transaction proposal, that proposal is
  // marked superseded so its own Confirm button can't save the stale guess.
  const editUserMessage = async (target: ChatMessage, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed || sending) return;
    updateMessage(target.id, { text: trimmed });

    const index = thread.findIndex((m) => m.id === target.id);
    const next = thread[index + 1];
    if (next?.role === "assistant" && next.action && !next.confirmed) {
      updateMessage(next.id, { superseded: true });
    }

    setSending(true);
    addMessage(await requestAssistantReply(trimmed, true));
    setSending(false);
  };

  // Editing an assistant's proposed transaction never calls the AI again —
  // the user is directly supplying the corrected fields. Either way this
  // mutates `target` itself in place and appends the new snapshot to its
  // editHistory — no new message is ever created for an edit:
  //   - not confirmed: nothing is saved yet, so a plain local update is
  //     enough; a fresh idempotency_key is generated since the one on
  //     record may already have been used by a prior failed attempt.
  //   - confirmed: a real Transaction already exists (target.transactionId,
  //     set by confirmAction below) — PATCH it directly. This must never
  //     fall back to POST /transactions; doing so would silently create a
  //     second, duplicate Transaction while leaving the original one
  //     orphaned in the backend (the bug this replaced).
  const editAction = (target: ChatMessage, payload: TransactionActionPayload) => {
    const timestamp = Date.now();
    const priorHistory: EditHistoryEntry[] =
      target.editHistory ?? (target.action ? [{ payload: target.action.payload, timestamp, source: "created" }] : []);
    const editHistory = [...priorHistory, { payload, timestamp, source: "edited" as const }];

    if (target.confirmed && target.transactionId) {
      updateTransaction.mutate(
        {
          id: target.transactionId,
          body: {
            amount: payload.amount,
            category_id: payload.category_id,
            occurred_at: payload.occurred_at,
            note: payload.note ?? undefined,
          },
        },
        {
          onSuccess: () => {
            updateMessage(target.id, { action: { ...target.action!, payload }, edited: true, editHistory });
          },
        },
      );
      return;
    }

    updateMessage(target.id, {
      action: { ...target.action!, payload, idempotency_key: uuidv4() },
      edited: true,
      editHistory,
    });
  };

  const confirmAction = (message: ChatMessage) => {
    if (!message.action) return;
    setConfirmingId(message.id);
    const { payload, idempotency_key } = message.action;
    createTransaction.mutate(
      { ...payload, note: payload.note ?? undefined, idempotency_key },
      {
        onSuccess: (transaction) => updateMessage(message.id, { confirmed: true, transactionId: transaction.id }),
        onError: (error) => {
          if (getErrorCode(error) === "INSUFFICIENT_BALANCE") {
            useToastStore.getState().show(getErrorMessage(error, "Số dư không đủ"), "error");
          }
        },
        onSettled: () => setConfirmingId(null),
      },
    );
  };

  // Swipe-to-edit dispatch (SwipeableMessageRow's onTriggerEdit), factored
  // out so the keyboard-open path below can delay it without duplicating the
  // decision tree.
  const openEditTarget = (item: ChatMessage) => {
    if (item.action) {
      setEditingActionMessage(item);
    } else if (item.role === "assistant" && (item.intent === "ambiguous" || item.actionType === "budget_wizard")) {
      // Nothing to "correct" on the AI's own question, or on a budget-wizard
      // card — same reasoning as the ambiguous-intent case above. In
      // practice SwipeableMessageRow's own `disabled` prop already stops the
      // gesture from firing for these, this is just defense in depth.
      return;
    } else {
      setEditingMessage(item);
    }
  };

  // If the keyboard happens to be open while the user swipes a bubble above
  // it, dismiss it first and let the input bar's margin settle back to its
  // closed-keyboard position before the modal opens on top — avoids the
  // sheet visibly jumping as the keyboard closes underneath it.
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
        // Inverted, so "the bottom" is scroll offset 0 — a fixed point that
        // needs no measurement at all. Chasing the bottom with scrollToEnd
        // never held: FlatList derives content height from the rows it has
        // actually measured and estimates the rest, and the viewport itself
        // keeps changing under it (safe-area insets resolve a frame after
        // mount, a bubble carrying a TransactionActionCard grows in a later
        // pass). Every one of those left the list a little short of the end,
        // which is exactly the "still have to scroll down a bit" report.
        // Inverting deletes the problem rather than papering over it: the
        // newest message is pinned at offset 0 on arrival and stays pinned as
        // new ones push the older content away.
        inverted
        style={styles.list}
        data={invertedThread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        // FlatList's default keyboardShouldPersistTaps="never" eats the
        // first touch on any row below a focused TextInput just to dismiss
        // the keyboard — SwipeableMessageRow's own PanResponder never even
        // sees that first gesture, so swipe-to-edit silently did nothing
        // while the keyboard was open. "handled" lets the touch reach the
        // row's PanResponder immediately; the keyboard still dismisses via
        // handleEditTrigger's own Keyboard.dismiss() once the swipe fires.
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <SwipeableMessageRow
            // README: user bubbles are right-aligned, assistant bubbles
            // left-aligned (ChatBubble.tsx) — swipe away from whichever edge
            // the bubble already sits on, Messenger's own swipe-to-reply
            // convention (see SwipeableMessageRow's doc comment).
            direction={item.role === "user" ? "left" : "right"}
            // The AI's own clarifying question (rare now — only a missing
            // amount or a non-transaction message) has nothing for the user
            // to "correct" the way an edit modal implies, unlike a
            // transaction proposal (always editable) or a user's own
            // message — don't let ambiguous AI questions or a budget-wizard
            // card be swiped-to-edit like ordinary text. See openEditTarget
            // for the rest of the dispatch.
            disabled={item.role === "assistant" && (item.intent === "ambiguous" || item.actionType === "budget_wizard")}
            onTriggerEdit={() => handleEditTrigger(item)}
          >
            <ChatBubble role={item.role} text={item.text}>
              {item.action && !item.superseded ? (
                <TransactionActionCard
                  action={item.action}
                  walletName={walletById.get(item.action.payload.wallet_id)?.name ?? "Ví"}
                  categoryName={categoryById.get(item.action.payload.category_id)?.name ?? "Danh mục"}
                  categoryIcon={categoryById.get(item.action.payload.category_id)?.icon}
                  categoryIconUrl={categoryById.get(item.action.payload.category_id)?.icon_url}
                  currency={walletById.get(item.action.payload.wallet_id)?.currency ?? "VND"}
                  confirmed={Boolean(item.confirmed)}
                  saving={confirmingId === item.id}
                  onConfirm={() => confirmAction(item)}
                  edited={item.edited}
                  onPressHistory={item.editHistory ? () => setHistoryMessage(item) : undefined}
                />
              ) : item.actionType === "budget_wizard" ? (
                <BudgetWizardCard
                  submitted={Boolean(item.budgetWizardSubmitted)}
                  createdCount={item.budgetWizardCreatedCount}
                  onPress={() => {
                    setBudgetWizardOriginMessageId(item.id);
                    setBudgetWizardOpen(true);
                  }}
                />
              ) : item.offerManualEntry ? (
                <Pressable style={styles.manualEntryButton} onPress={() => setManualEntryOpen(true)}>
                  <Text style={styles.manualEntryLabel}>Tạo giao dịch thủ công</Text>
                </Pressable>
              ) : null}
            </ChatBubble>
          </SwipeableMessageRow>
        )}
        // No counter-transform on either of these: VirtualizedList already
        // composes its own inversion style onto the header/empty slots, so
        // adding a second scaleY would cancel it out and render them upside
        // down.
        ListEmptyComponent={
          <Text style={styles.hint}>
            Cho mình biết bạn đã chi hay thu gì — vd: &ldquo;Cà phê 50k tiền mặt&rdquo; — mình sẽ soạn sẵn giao dịch cho bạn.
          </Text>
        }
        // Header, not footer: on an inverted list the header is what renders
        // at the visual bottom, which is where the typing dots belong.
        ListHeaderComponent={
          sending ? (
            <View style={styles.typingRow}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      {!keyboardVisible ? (
        <View style={styles.quickActionRow}>
          <Pressable
            testID="btn-open-budget-wizard"
            style={styles.quickActionChip}
            onPress={() => {
              setBudgetWizardOriginMessageId(null);
              setBudgetWizardOpen(true);
            }}
          >
            <SparkleIcon size={14} />
            <Text style={styles.quickActionLabel}>Lập ngân sách</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          // keyboardHeight is reserved in full, not just a nudge — Android's
          // windowSoftInputMode=resize (app.json) is a no-op once the app
          // opts into edge-to-edge (Expo's default here), so the window
          // never actually shrinks around the keyboard; without reserving
          // the real height ourselves the bar stays hidden behind it.
          { marginBottom: keyboardVisible ? keyboardHeight + KEYBOARD_GAP : insets.bottom + NAV_CLEARANCE },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Mô tả một giao dịch…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          textAlignVertical="top"
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={!input.trim() || sending}>
          <SendIcon size={18} />
        </Pressable>
      </View>
    </View>

    <EditMessageModal
      visible={Boolean(editingMessage)}
      initialText={editingMessage?.text ?? ""}
      onCancel={() => setEditingMessage(null)}
      onSave={(text) => {
        const target = editingMessage;
        setEditingMessage(null);
        if (!target) return;
        if (target.role === "user") {
          editUserMessage(target, text);
        } else {
          updateMessage(target.id, { text });
        }
      }}
    />

    <EditTransactionModal
      visible={Boolean(editingActionMessage)}
      payload={editingActionMessage?.action?.payload ?? null}
      lockWalletAndType={Boolean(editingActionMessage?.confirmed)}
      onClose={() => setEditingActionMessage(null)}
      onSave={(payload) => {
        const target = editingActionMessage;
        setEditingActionMessage(null);
        if (target) editAction(target, payload);
      }}
    />

    <EditHistoryDialog
      visible={Boolean(historyMessage)}
      history={historyMessage?.editHistory ?? []}
      currency={
        historyMessage?.action ? walletById.get(historyMessage.action.payload.wallet_id)?.currency ?? "VND" : "VND"
      }
      onClose={() => setHistoryMessage(null)}
    />

    <TransactionFormModal visible={manualEntryOpen} onClose={() => setManualEntryOpen(false)} />

    <BudgetWizardModal
      visible={budgetWizardOpen}
      onClose={() => setBudgetWizardOpen(false)}
      onCompleted={(createdCount) => {
        if (budgetWizardOriginMessageId) {
          updateMessage(budgetWizardOriginMessageId, { budgetWizardSubmitted: true, budgetWizardCreatedCount: createdCount });
        }
      }}
    />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary },
  list: { flex: 1 },
  // paddingVertical, not paddingBottom: `inverted` mirrors the content
  // container, so a bottom-only pad would end up above the oldest message
  // instead of below the newest one.
  thread: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  hint: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  typingRow: { alignItems: "flex-start" },
  manualEntryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  manualEntryLabel: { ...typography.label, color: colors.onGreen },
  quickActionRow: { marginHorizontal: spacing.xl, flexDirection: "row" },
  quickActionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.sm,
  },
  quickActionLabel: { ...typography.caption, color: colors.textPrimary },
  inputBar: {
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  // ~3 lines of typography.body before it scrolls internally instead of
  // growing further (multiline TextInputs scroll their own content once
  // it exceeds maxHeight — no manual measurement needed).
  input: { flex: 1, minHeight: 40, maxHeight: 88, color: colors.textPrimary, paddingVertical: spacing.sm, ...typography.body },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
