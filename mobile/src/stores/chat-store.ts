import { create } from "zustand";

import { ChatMessage } from "@/features/ai-chat/types";

// AI Chat has no history GET endpoint (backend/internal/handler/chat_handler.go
// — the thread is client-only state, see src/features/ai-chat/types.ts). It
// was previously local useState in app/(app)/ai-chat.tsx, which reset every
// time that route unmounted (e.g. tapping any other bottom-nav tab). Lifted
// to a Zustand store — same "global/client state" convention as
// session-store.ts — so the conversation survives navigating away and back
// within the app session. Not persisted to disk: it's cleared on logout
// (see profile.tsx) since it contains another user's financial context.
interface ChatState {
  thread: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  thread: [],
  addMessage: (message) => set((state) => ({ thread: [...state.thread, message] })),
  updateMessage: (id, patch) =>
    set((state) => ({ thread: state.thread.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  clear: () => set({ thread: [] }),
}));
