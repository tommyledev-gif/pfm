import { StoreApi, createStore, useStore } from "zustand";

interface ChatDraft {
  text: string;
  setText: (text: string) => void;
}

export type ChatDraftStore = StoreApi<ChatDraft>;

/**
 * The recording input's text. Outside React state so a keystroke re-renders
 * only the composer that reads it, and outside a global store so it is
 * created and dropped with the chat screen (one per screen, per session).
 * It outlives the pane, which remounts on every mode switch.
 */
export function createChatDraftStore(): ChatDraftStore {
  return createStore<ChatDraft>()((set) => ({ text: "", setText: (text) => set({ text }) }));
}

export function useChatDraftText(store: ChatDraftStore): string {
  return useStore(store, (s) => s.text);
}
