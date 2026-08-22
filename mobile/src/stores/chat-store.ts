import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ChatMessage } from "@/features/ai-chat/types";

// AI Chat has no history GET endpoint (backend/internal/handler/chat_handler.go
// — the thread is client-only state, see src/features/ai-chat/types.ts).
// Persisted to AsyncStorage (not expo-secure-store — its ~2KB per-key limit
// on Android can't hold a growing thread of messages + transaction action
// payloads) so the conversation, including confirm/action cards, survives
// app restarts, not just in-session navigation. Still cleared on logout
// (see profile.tsx) since it contains another user's financial context.
interface ChatState {
  thread: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      thread: [],
      addMessage: (message) => set((state) => ({ thread: [...state.thread, message] })),
      updateMessage: (id, patch) =>
        set((state) => ({ thread: state.thread.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeMessage: (id) => set((state) => ({ thread: state.thread.filter((m) => m.id !== id) })),
      clear: () => set({ thread: [] }),
    }),
    {
      name: "pfm_chat_thread",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
