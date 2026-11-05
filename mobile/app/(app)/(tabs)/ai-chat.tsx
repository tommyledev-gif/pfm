import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { entrance } from "@/components/motion/motion-tokens";
import { Screen } from "@/components/shared/Screen";
import { closeParkedSwipeRow } from "@/components/shared/use-swipe-actions";
import { ChatModeBackdrop } from "@/features/ai-chat/components/ChatModeBackdrop";
import { ChatModeHeader } from "@/features/ai-chat/components/ChatModeHeader";
import { ChatOverlays } from "@/features/ai-chat/components/ChatOverlays";
import { ChatSearchBar } from "@/features/ai-chat/components/ChatSearchBar";
import { ChatSearchResults } from "@/features/ai-chat/components/ChatSearchResults";
import { ChatSearchStepper } from "@/features/ai-chat/components/ChatSearchStepper";
import { ConsultPane } from "@/features/ai-chat/components/ConsultPane";
import { RecordingPane } from "@/features/ai-chat/components/RecordingPane";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { createChatDraftStore } from "@/features/ai-chat/chat-draft";
import { dismissKeyboardThen } from "@/features/ai-chat/dismiss-keyboard-then";
import { CHAT_MODE_META, ChatMode, useChatModeStore } from "@/features/ai-chat/chat-mode";
import { isConsultMessage } from "@/features/ai-chat/consult-message";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { useChatOverlays } from "@/features/ai-chat/hooks/use-chat-overlays";
import { useChatSearch } from "@/features/ai-chat/hooks/use-chat-search";
import { MessageJump } from "@/features/ai-chat/hooks/use-message-jump";
import { useSearchStepper } from "@/features/ai-chat/hooks/use-search-stepper";
import { isTombstone } from "@/features/ai-chat/tombstone";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { useChatThreadQuery } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage, SavedProposalPatch, TransactionActionPayload } from "@/features/ai-chat/types";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useAfterTabSwitch } from "@/lib/use-after-tab-switch";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useChatStore, useChatThreadRestored } from "@/stores/chat-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // In a store: the thread outlives this screen and is reset per User by
  // session-scoped-reset.ts.
  const thread = useChatStore((s) => s.thread);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const hydrateThread = useChatStore((s) => s.hydrateThread);

  // Not persisted — see chat-mode.ts.
  const mode = useChatModeStore((s) => s.mode);
  const setMode = useChatModeStore((s) => s.setMode);
  // The pane on screen when the tab first mounts just shows; a switch fades in.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  const [draftStore] = useState(createChatDraftStore);
  // Set when "Switch to recording" carries a question over, so the recording
  // input mounts focused; cleared once it has taken focus.
  const [focusRecordingInput, setFocusRecordingInput] = useState(false);

  const overlays = useChatOverlays();
  const afterTabSwitch = useAfterTabSwitch();

  const { focusMessageId, focusedAt, openEdit } = useLocalSearchParams<{
    focusMessageId?: string;
    focusedAt?: string;
    openEdit?: string;
  }>();

  // Restores the synced thread when the local copy is empty (logout, account
  // switch, reinstall, new device). At most once per User per app run (the
  // store's restoredFor), so a cached server snapshot never replays over
  // local changes. Read live: this screen outlives account switches.
  const userId = useCurrentUserId();
  const ownerId = useChatStore((s) => s.ownerId);
  const restoredFor = useChatStore((s) => s.restoredFor);
  const needsServerThread = userId !== null && ownerId === userId && restoredFor !== userId && thread.length === 0;
  const threadQuery = useChatThreadQuery(userId, needsServerThread);
  useEffect(() => {
    if (needsServerThread && userId && threadQuery.data) hydrateThread(threadQuery.data, userId);
  }, [needsServerThread, userId, threadQuery.data, hydrateThread]);

  // Skeleton until there is an answer, so the empty state never flashes in
  // front of a thread that is about to appear. A failed or offline restore
  // falls through to the empty state.
  const threadRestored = useChatThreadRestored();
  const threadLoading =
    !threadRestored || (needsServerThread && !threadQuery.isError && !isWaitingForNetwork(threadQuery));

  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();

  const chat = useChatActions({
    onSent: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  });
  const removal = useTransactionRemoval();

  // Recording messages only, newest first for the inverted list. The store
  // keeps natural order for every other reader.
  const invertedThread = useMemo(() => thread.filter((m) => !isConsultMessage(m)).reverse(), [thread]);
  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);
  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  // The header's search covers the pane on screen; a picked result (or a deep
  // link) is a jump the pane carries out (useMessageJump).
  const paneMessages = useMemo(
    () => (mode === "consult" ? thread.filter(isConsultMessage).reverse() : invertedThread),
    [mode, thread, invertedThread],
  );
  const search = useChatSearch(paneMessages);
  const [jump, setJump] = useState<MessageJump | null>(null);
  const pane = mode === "consult" ? "consult" : "recording";
  const stepper = useSearchStepper((id) => setJump({ id, nonce: Date.now() }), { searching: search.open, pane });
  const jumpToResult = useLatestCallback((id: string) => {
    Keyboard.dismiss();
    stepper.start(search.hits.map((hit) => hit.message.id), id);
    search.closeSearch();
    setJump({ id, nonce: Date.now() });
  });

  // A parked swipe row never stays open over a thread that moved under it.
  useEffect(() => {
    closeParkedSwipeRow();
  }, [thread.length]);

  useEffect(() => {
    if (!focusMessageId) return;
    // Deep links always point at a Transaction proposal (recording pane).
    setMode("transaction");
    search.closeSearch();
    if (!invertedThread.some((m) => m.id === focusMessageId)) return;
    setJump({ id: focusMessageId, nonce: Date.now() });
    if (openEdit === "1") {
      const message = thread.find((m) => m.id === focusMessageId);
      // Once this tab has slid in: opened during the slide, the sheet shook.
      if (message?.action && !isTombstone(message)) afterTabSwitch(() => overlays.setEditingActionMessage(message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMessageId, focusedAt]);

  // "Lập ngân sách" opens the wizard at once (keyboard down first: it covers
  // the composer); the mode lasts while it is open.
  const handleSelectMode = useLatestCallback((next: ChatMode) => {
    if (next === mode && next !== "budget") return;
    setMode(next);
    if (next === "budget") dismissKeyboardThen(() => overlays.openBudgetWizard(null))();
  });
  // Never sends: the carried question lands in the input for the User to send.
  const handleSwitchToRecording = useLatestCallback((prefill?: string) => {
    setMode("transaction");
    const text = prefill?.trim();
    if (!text) return;
    draftStore.getState().setText(text);
    setFocusRecordingInput(true);
  });
  const handleCloseBudgetWizard = useLatestCallback(() => {
    overlays.setBudgetWizardOpen(false);
    if (mode === "budget") setMode("transaction");
  });

  const clearInputFocusRequest = useCallback(() => setFocusRecordingInput(false), []);
  const openHistory = useMemo(() => dismissKeyboardThen(overlays.openHistory), [overlays.openHistory]);
  const openBudgetWizard = useMemo(() => dismissKeyboardThen(overlays.openBudgetWizard), [overlays.openBudgetWizard]);
  const openManualEntry = useLatestCallback(dismissKeyboardThen(() => overlays.setManualEntryOpen(true)));

  const closeEditingMessage = useLatestCallback(() => overlays.setEditingMessage(null));
  const saveEditingMessage = useLatestCallback((text: string) => {
    const target = overlays.editingMessage;
    overlays.setEditingMessage(null);
    if (target) void chat.editUserMessage(target, text);
  });
  const closeEditingAction = useLatestCallback(() => overlays.setEditingActionMessage(null));
  const saveEditingAction = useLatestCallback((payload: TransactionActionPayload, savedPatch: SavedProposalPatch) => {
    const target = overlays.editingActionMessage;
    overlays.setEditingActionMessage(null);
    if (target) chat.editAction(target, payload, savedPatch);
  });
  const closeHistory = useLatestCallback(() => overlays.setHistoryMessage(null));
  const closeTombstone = useLatestCallback(() => overlays.setTombstoneMessage(null));
  const closeManualEntry = useLatestCallback(() => overlays.setManualEntryOpen(false));
  const budgetWizardCompleted = useLatestCallback((createdCount: number) => {
    if (!overlays.budgetWizardOriginMessageId) return;
    updateMessage(overlays.budgetWizardOriginMessageId, {
      budgetWizardSubmitted: true,
      budgetWizardCreatedCount: createdCount,
    });
  });

  return (
    <Screen>
      {/* Outside the content View so its wash runs up under the status bar too. */}
      <ChatModeBackdrop mode={mode} />
      <View style={styles.screen}>
        {search.open ? (
          <ChatSearchBar
            query={search.query}
            onChangeQuery={search.setQuery}
            searchableCount={search.searchableCount}
            onClose={search.closeSearch}
          />
        ) : (
          <ChatModeHeader
            mode={mode}
            onSelectMode={handleSelectMode}
            onPressSearch={search.openSearch}
            onOpenManualEntry={openManualEntry}
          />
        )}

        {/* Keyed by pane, not mode: recording and the budget wizard share one. */}
        <Animated.View
          key={pane}
          entering={firstRender.current ? undefined : entrance("fade")}
          style={styles.pane}
        >
          {mode === "consult" ? (
            <ConsultPane
              loading={threadLoading}
              bottomInset={insets.bottom}
              onSwitchToRecording={handleSwitchToRecording}
              jump={jump}
            />
          ) : (
            <RecordingPane
              listRef={listRef}
              messages={invertedThread}
              loading={threadLoading}
              walletById={walletById}
              categoryById={categoryById}
              chat={chat}
              draftStore={draftStore}
              autoFocusInput={focusRecordingInput}
              onInputFocused={clearInputFocusRequest}
              bottomInset={insets.bottom}
              mode={mode}
              onTriggerEdit={overlays.triggerEdit}
              onTriggerDelete={removal.request}
              onPressHistory={openHistory}
              onOpenBudgetWizard={openBudgetWizard}
              onOpenManualEntry={openManualEntry}
              jump={jump}
            />
          )}
          {/* Only once there is something typed: an empty search leaves the
              thread in view. */}
          {search.open && search.query.trim() ? (
            <ChatSearchResults hits={search.hits} tint={CHAT_MODE_META[mode].tint} onSelect={jumpToResult} />
          ) : null}
          {stepper.active && !search.open ? (
            <ChatSearchStepper
              position={stepper.position}
              count={stepper.count}
              tint={CHAT_MODE_META[mode].tint}
              onOlder={stepper.older}
              onNewer={stepper.newer}
              onClose={stepper.stop}
            />
          ) : null}
        </Animated.View>
      </View>

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
        onCloseEditingMessage={closeEditingMessage}
        onSaveEditingMessage={saveEditingMessage}
        onCloseEditingAction={closeEditingAction}
        onSaveEditingAction={saveEditingAction}
        onCloseHistory={closeHistory}
        onCloseTombstone={closeTombstone}
        onCloseManualEntry={closeManualEntry}
        onCloseBudgetWizard={handleCloseBudgetWizard}
        onBudgetWizardCompleted={budgetWizardCompleted}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // No background of its own — Screen paints bgApp, and ChatModeBackdrop
  // has to show through.
  screen: { flex: 1 },
  pane: { flex: 1 },
});
