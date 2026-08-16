import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SendIcon, SparkleIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TypingIndicator } from "@/components/shared/TypingIndicator";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";

let idCounter = 0;
const nextId = () => `msg_${++idCounter}`;

// Design's typing indicator is meant to be felt, not just a technicality —
// README: "typing indicator (~1.3s)" — so even a fast API response holds the
// dots for a beat before the reply appears.
const MIN_TYPING_MS = 1300;

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

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const sendMessage = useSendChatMessageMutation();
  const createTransaction = useCreateTransactionMutation();

  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addMessage({ id: nextId(), role: "user", text });
    setSending(true);

    const startedAt = Date.now();
    try {
      const response = await sendMessage.mutateAsync({ message: text });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
      }
      addMessage({ id: nextId(), role: "assistant", text: response.message, action: response.actions[0] });
    } catch {
      addMessage({ id: nextId(), role: "assistant", text: "Sorry, I couldn't process that. Please try again." });
    } finally {
      setSending(false);
    }
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.header}>
        <SparkleIcon size={20} />
        <Text style={styles.headerTitle}>Noctis AI</Text>
      </View>

      <FlatList
        ref={listRef}
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
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
              />
            ) : null}
          </ChatBubble>
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

      <View style={[styles.inputBar, { bottom: insets.bottom + 120 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Describe a transaction…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={!input.trim() || sending}>
          <SendIcon size={18} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary },
  thread: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: 180, flexGrow: 1 },
  hint: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  typingRow: { alignItems: "flex-start" },
  inputBar: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.pill,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: { flex: 1, color: colors.textPrimary, paddingVertical: spacing.sm, ...typography.body },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
