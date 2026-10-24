import { useState } from "react";
import { Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { onlineManager } from "@tanstack/react-query";

import { ChatComposer } from "@/features/ai-chat/components/ChatComposer";
import { ChatInputBar } from "@/features/ai-chat/components/ChatInputBar";
import { ImageAttachButton } from "@/features/ai-chat/components/ImageAttachButton";
import { LocationPinToggle } from "@/features/ai-chat/components/LocationPinToggle";
import { OfflineManualEntryDialog } from "@/features/ai-chat/components/OfflineManualEntryDialog";
import { PhraseSuggestions } from "@/features/ai-chat/components/PhraseSuggestions";
import { ChatDraftStore, useChatDraftText } from "@/features/ai-chat/chat-draft";
import { ChatMode } from "@/features/ai-chat/chat-mode";
import { useChatActions } from "@/features/ai-chat/hooks/use-chat-actions";
import { draftFromText } from "@/features/transactions/draft-from-text";
import { useManualDraftStore } from "@/features/transactions/manual-draft-store";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useLinger } from "@/lib/use-linger";
import { useCurrentUserId } from "@/stores/use-current-user-id";

// The suggestion area may take at most this share of the pane's height.
const SUGGESTION_MAX_HEIGHT_RATIO = 0.2;
const PHRASE_PANEL_LINGER_MS = 150;

interface RecordingComposerProps {
  draftStore: ChatDraftStore;
  chat: ReturnType<typeof useChatActions>;
  mode: ChatMode;
  bottomInset: number;
  paneHeight: number;
  /** Focus the input on mount — set when arriving from analysis mode. */
  autoFocusInput: boolean;
  onInputFocused: () => void;
  onOpenBudgetWizard: (originMessageId: string | null) => void;
  onHeightChange: (height: number) => void;
}

/**
 * The recording pane's floating input, phrase suggestions and attach button.
 * Owns everything that changes per keystroke, so typing never re-renders the
 * thread above it.
 */
export function RecordingComposer({
  draftStore,
  chat,
  mode,
  bottomInset,
  paneHeight,
  autoFocusInput,
  onInputFocused,
  onOpenBudgetWizard,
  onHeightChange,
}: RecordingComposerProps) {
  const router = useRouter();
  const userId = useCurrentUserId();
  const openDraft = useManualDraftStore((s) => s.openDraft);
  const input = useChatDraftText(draftStore);
  const setInput = draftStore.getState().setText;
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [phraseSearchFocused, setPhraseSearchFocused] = useState(false);
  const [inputFocusNonce, setInputFocusNonce] = useState(0);
  // Focus moving from the message to the phrase search blurs one before the
  // other gains it; the panel holding the search must not unmount in between.
  const phrasePanelOpen = useLinger(inputFocused || phraseSearchFocused, PHRASE_PANEL_LINGER_MS);

  const handleFocusChange = (focused: boolean) => {
    setInputFocused(focused);
    if (focused) onInputFocused();
  };

  // Offline the AI cannot read the message; the manual form can still queue it.
  const handleSend = () => {
    if (!onlineManager.isOnline()) {
      // A Modal: the keyboard goes first so the bar comes down under it.
      Keyboard.dismiss();
      setOfflineDialogOpen(true);
      return;
    }
    const text = input;
    setInput("");
    void chat.send(text);
  };
  const handleManualEntry = () => {
    setOfflineDialogOpen(false);
    openDraft(draftFromText(input));
    setInput("");
    Keyboard.dismiss();
    router.navigate("/transactions");
  };

  return (
    <>
      <ChatComposer onHeightChange={onHeightChange}>
        <ChatInputBar
          value={input}
          onChangeText={setInput}
          // Offline, the typed text stays in the box (AC-OFF-08).
          onSend={handleSend}
          sending={chat.sending}
          bottomInset={bottomInset}
          onOpenBudgetWizard={() => onOpenBudgetWizard(null)}
          // The real mode: while the budget wizard is open the bar takes its colour.
          mode={mode}
          autoFocus={autoFocusInput}
          onFocusChange={handleFocusChange}
          focusNonce={inputFocusNonce}
          leading={
            <>
              <ImageAttachButton disabled={chat.sending} onSend={(uri, caption) => void chat.sendImage(uri, caption)} />
              <LocationPinToggle />
            </>
          }
          aboveInput={
            <PhrasePanel
              open={phrasePanelOpen}
              input={input}
              userId={userId}
              paneHeight={paneHeight}
              onSelect={(text, fromSearch) => {
                setInput(text);
                // Picked from the search: the cursor goes back to the message.
                if (fromSearch) setInputFocusNonce((n) => n + 1);
              }}
              onSearchFocusChange={setPhraseSearchFocused}
            />
          }
        />
      </ChatComposer>
      <OfflineManualEntryDialog
        visible={offlineDialogOpen}
        onConfirm={handleManualEntry}
        onCancel={() => setOfflineDialogOpen(false)}
      />
    </>
  );
}

interface PhrasePanelProps {
  open: boolean;
  input: string;
  userId: string | null;
  paneHeight: number;
  onSelect: (text: string, fromSearch: boolean) => void;
  onSearchFocusChange: (focused: boolean) => void;
}

// Holds the keyboard subscription, so a keyboard event re-renders this and
// nothing above it.
function PhrasePanel({ open, input, userId, paneHeight, onSelect, onSearchFocusChange }: PhrasePanelProps) {
  const keyboardHeight = useKeyboardHeight();
  if (!open) return null;
  return (
    <PhraseSuggestions
      input={input}
      userId={userId}
      // Of the part of the pane the keyboard does not cover.
      maxHeight={Math.max(0, paneHeight - keyboardHeight) * SUGGESTION_MAX_HEIGHT_RATIO}
      onSelect={onSelect}
      onSearchFocusChange={onSearchFocusChange}
    />
  );
}
