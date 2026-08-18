import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { EditMessageModal } from "@/features/ai-chat/components/EditMessageModal";
import { EditTransactionModal } from "@/features/ai-chat/components/EditTransactionModal";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { ChatMessage, TransactionActionPayload } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";

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

// Holding a bubble for this long opens the edit modal directly (skips an
// intermediate "Edit" affordance — a modal is simpler than expanding the
// bubble in place and reuses the same growing-textarea/keyboard handling).
// Deliberately close to the OS-standard long-press timing (~500ms on both
// iOS and Android), not a longer custom value: FlatList's own scroll
// responder can claim the touch the moment it sees a few pixels of finger
// drift, and holding a phone perfectly still for multiple seconds is
// unrealistic — a 2000ms delay was tried first and reliably lost that race,
// making the gesture never fire at all.
const EDIT_LONG_PRESS_MS = 500;

// BottomNav (components/shared/BottomNav.tsx) floats at insets.bottom + 16,
// standing 64px tall — this is how far above the screen's bottom edge the
// input bar's own bottom must sit to clear it when the keyboard is closed.
const NAV_CLEARANCE = 120;

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // Thread lives in a Zustand store (chat-store.ts), not local state — this
  // screen unmounts every time a bottom-nav tab is tapped, and local state
  // would lose the whole conversation on every navigation.
  const thread = useChatStore((s) => s.thread);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Two different long-press targets need two different editors: a plain
  // chat bubble (user text, or an actionless assistant reply) opens a text
  // editor, while an assistant bubble carrying a transaction proposal opens
  // the structured form instead — see the renderItem long-press dispatch.
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingActionMessage, setEditingActionMessage] = useState<ChatMessage | null>(null);
  // Drives the input bar's own margin directly off the measured keyboard
  // height — see use-keyboard-height.ts for why this isn't
  // KeyboardAvoidingView. BottomNav (app/(app)/_layout.tsx) hides itself on
  // the same signal, so the input only needs nav clearance while it's closed.
  const keyboardHeight = useKeyboardHeight();
  const keyboardVisible = keyboardHeight > 0;

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const sendMessage = useSendChatMessageMutation();
  const createTransaction = useCreateTransactionMutation();

  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  // Shared by both a fresh send and a resend-after-editing-the-user-message
  // flow — same typing-indicator pacing and fallback-on-failure text either
  // way, only the resulting message's `edited` flag differs.
  const requestAssistantReply = async (message: string, edited?: boolean): Promise<ChatMessage> => {
    const startedAt = Date.now();
    try {
      const response = await sendMessage.mutateAsync({ message });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
      }
      return { id: nextId(), role: "assistant", text: response.message, action: response.actions[0], edited };
    } catch {
      return {
        id: nextId(),
        role: "assistant",
        text: "Sorry, I couldn't process that. Please try again.",
        edited,
      };
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addMessage({ id: nextId(), role: "user", text });
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
  // the user is directly supplying the corrected fields — so this just
  // constructs a new action with a fresh idempotency_key (the original came
  // from the AI Service; this one never did) and appends it, marking the
  // stale original superseded the same way editUserMessage does.
  const editAction = (target: ChatMessage, payload: TransactionActionPayload) => {
    if (!target.confirmed) {
      updateMessage(target.id, { superseded: true });
    }
    addMessage({
      id: nextId(),
      role: "assistant",
      text: "Here's the corrected transaction.",
      action: { type: "create_transaction", payload, idempotency_key: uuidv4(), confidence: 1 },
      edited: true,
    });
  };

  const confirmAction = (message: ChatMessage) => {
    if (!message.action) return;
    setConfirmingId(message.id);
    const { payload, idempotency_key } = message.action;
    createTransaction.mutate(
      { ...payload, note: payload.note ?? undefined, idempotency_key },
      {
        onSuccess: () => updateMessage(message.id, { confirmed: true }),
        onSettled: () => setConfirmingId(null),
      },
    );
  };

  return (
    <Screen>
    <View style={styles.screen}>
      <View style={styles.header}>
        <SparkleIcon size={20} />
        <Text style={styles.headerTitle}>Noctis AI</Text>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => (item.action ? setEditingActionMessage(item) : setEditingMessage(item))}
            delayLongPress={EDIT_LONG_PRESS_MS}
          >
            <ChatBubble role={item.role} text={item.text}>
              {item.action ? (
                <TransactionActionCard
                  action={item.action}
                  walletName={walletById.get(item.action.payload.wallet_id)?.name ?? "Wallet"}
                  categoryName={categoryById.get(item.action.payload.category_id)?.name ?? "Category"}
                  currency={walletById.get(item.action.payload.wallet_id)?.currency ?? "VND"}
                  confirmed={Boolean(item.confirmed)}
                  saving={confirmingId === item.id}
                  onConfirm={() => confirmAction(item)}
                  edited={item.edited}
                  superseded={item.superseded}
                />
              ) : null}
            </ChatBubble>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.hint}>
            Tell me what you spent — e.g. &ldquo;Coffee 50k from cash&rdquo; — and I&apos;ll draft the transaction for you.
          </Text>
        }
        ListFooterComponent={
          sending ? (
            <View style={styles.typingRow}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputBar,
          { marginBottom: keyboardVisible ? spacing.sm : insets.bottom + NAV_CLEARANCE },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Describe a transaction…"
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
      onClose={() => setEditingActionMessage(null)}
      onSave={(payload) => {
        const target = editingActionMessage;
        setEditingActionMessage(null);
        if (target) editAction(target, payload);
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
  thread: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  hint: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  typingRow: { alignItems: "flex-start" },
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
