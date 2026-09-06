import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { syncChatThreadRequest } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage } from "@/features/ai-chat/types";

// Persisted to AsyncStorage (not expo-secure-store — its ~2KB per-key limit
// on Android can't hold a growing thread of messages + transaction action
// payloads) so the conversation, including confirm/action cards, survives
// app restarts, not just in-session navigation. Still cleared on logout
// (see settings.tsx) since it contains another user's financial context —
// GET /ai/chat/thread (use-chat-thread-sync.ts) restores it from the server
// on the next login, since every mutation here also debounce-syncs to the
// same backend cache (SYNC_DEBOUNCE_MS below).

// Debounced 3s after the last thread mutation (a new message, an edit, a
// confirm) — not on every keystroke, since nothing here fires from typing,
// only from addMessage/updateMessage. Module-level, not store state: the
// timer must survive ai-chat.tsx unmounting (it's popped every time the user
// switches bottom-nav tabs) and must be cancelable from clear() so a logout
// can't let a stale timer fire against the now-cleared session.
const SYNC_DEBOUNCE_MS = 3000;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(getThread: () => ChatMessage[]) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const thread = getThread();
    if (!thread.length) return;
    // Best-effort — a failed sync (offline, expired session) just leaves the
    // next mutation to reschedule it; settings.tsx's logout flush gets one
    // more attempt before the local copy is wiped.
    syncChatThreadRequest(thread).catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

interface ChatState {
  thread: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  // Drops in a thread fetched from GET /ai/chat/thread (ai-chat.tsx, only
  // called once when the local thread is empty) — a plain replace, not
  // merged with scheduleSync, since restoring server state is not itself a
  // local change that needs re-syncing.
  hydrateThread: (messages: ChatMessage[]) => void;
  clear: () => void;
  // Best-effort immediate flush — settings.tsx awaits this (capped by its own
  // short timeout) before logout clears the local copy, so the last few
  // seconds of activity still sitting in the debounce timer aren't lost.
  flushSync: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      thread: [],
      addMessage: (message) => {
        set((state) => ({ thread: [...state.thread, message] }));
        scheduleSync(() => get().thread);
      },
      updateMessage: (id, patch) => {
        set((state) => ({ thread: state.thread.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
        scheduleSync(() => get().thread);
      },
      removeMessage: (id) => set((state) => ({ thread: state.thread.filter((m) => m.id !== id) })),
      hydrateThread: (messages) => set({ thread: messages }),
      clear: () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        set({ thread: [] });
      },
      flushSync: async () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        const thread = get().thread;
        if (!thread.length) return;
        await syncChatThreadRequest(thread);
      },
    }),
    {
      name: "pfm_chat_thread",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
