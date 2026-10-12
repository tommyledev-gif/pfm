import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/components/shared/Screen";
import { ChatModeBackdrop } from "@/features/ai-chat/components/ChatModeBackdrop";
import { ChatModeHeader } from "@/features/ai-chat/components/ChatModeHeader";
import { ChatModePicker } from "@/features/ai-chat/components/ChatModePicker";
import { ChatOverlays } from "@/features/ai-chat/components/ChatOverlays";
import { ConsultPane } from "@/features/ai-chat/components/ConsultPane";
import { RecordingPane } from "@/features/ai-chat/components/RecordingPane";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { ChatMode, useChatModeStore } from "@/features/ai-chat/chat-mode";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { useChatOverlays } from "@/features/ai-chat/hooks/use-chat-overlays";
import { isTombstone } from "@/features/ai-chat/tombstone";
import { useKeyboardHeight, useKeyboardVisible } from "@/lib/use-keyboard-height";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useChatThreadQuery } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";

// A beat for the list to finish its mount/measure pass before scrolling to a
// deep-linked message — RecordingPane retries if the row still was not measured.
const FOCUS_SCROLL_DELAY_MS = 50;

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Thread lives in a store, not local state: it outlives this screen, and is
  // reset per User by session-scoped-reset.ts.
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
  // Set when "Switch to recording" carries a question over, so the recording
  // input mounts focused; cleared once it has taken focus.
  const [focusRecordingInput, setFocusRecordingInput] = useState(false);
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

  // Restores the synced thread when the local copy is empty — after a logout,
  // an account switch, a reinstall or a new device wiped it. At most once per
  // User per app run (the store's restoredFor), so a cached server snapshot
  // can never be replayed over local changes made since (a deleted
  // transaction's tombstone reverting to a live card is how that showed up).
  //
  // ⚠️ Read live, not frozen at mount. Tabs stay mounted once visited, so this
  // screen lives through logouts and account switches; a mount-time flag kept
  // the previous account's answer and the next account's thread was never
  // restored.
  const userId = useCurrentUserId();
  const ownerId = useChatStore((s) => s.ownerId);
  const restoredFor = useChatStore((s) => s.restoredFor);
  const needsServerThread = userId !== null && ownerId === userId && restoredFor !== userId && thread.length === 0;
  const threadQuery = useChatThreadQuery(userId, needsServerThread);
  useEffect(() => {
    if (needsServerThread && userId && threadQuery.data) hydrateThread(threadQuery.data, userId);
  }, [needsServerThread, userId, threadQuery.data, hydrateThread]);

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

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
  // Never sends: the carried question lands in the input for the User to
  // check and send themselves. A reply with no remembered question just
  // switches, leaving the draft alone.
  const handleSwitchToRecording = (prefill?: string) => {
    setMode("transaction");
    const text = prefill?.trim();
    if (!text) return;
    setInput(text);
    setFocusRecordingInput(true);
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
            bottomInset={insets.bottom}
            onSwitchToRecording={handleSwitchToRecording}
          />
        ) : (
          <RecordingPane
            listRef={listRef}
            messages={invertedThread}
            walletById={walletById}
            categoryById={categoryById}
            chat={chat}
            closeSignal={closeSignal}
            onScrollBeginDrag={() => setCloseSignal((n) => n + 1)}
            input={input}
            onChangeInput={setInput}
            autoFocusInput={focusRecordingInput}
            onInputFocused={() => setFocusRecordingInput(false)}
            keyboardVisible={keyboardVisible}
            keyboardHeight={keyboardHeight}
            bottomInset={insets.bottom}
            mode={mode}
            onTriggerEdit={overlays.triggerEdit}
            onTriggerDelete={removal.request}
            onPressHistory={overlays.openHistory}
            onOpenBudgetWizard={overlays.openBudgetWizard}
            onOpenManualEntry={() => overlays.setManualEntryOpen(true)}
          />
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
