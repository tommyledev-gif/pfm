import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { chatThreadQueryKey, syncChatThreadRequest } from "@/features/ai-chat/api/use-chat-thread-sync";
import { ChatMessage } from "@/features/ai-chat/types";
import { userIdFromAccessToken } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { useSessionStore } from "@/stores/session-store";

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

// Set once the saved thread has been read back, or the read failed: until
// then an empty thread means "not loaded yet", not "no messages".
let threadRestored = false;
const restoreListeners = new Set<() => void>();
function markThreadRestored() {
  threadRestored = true;
  restoreListeners.forEach((listener) => listener());
}
function subscribeThreadRestored(listener: () => void) {
  restoreListeners.add(listener);
  return () => restoreListeners.delete(listener);
}

// What we just pushed IS what the server now holds, so the GET's cache entry
// is stale the moment a sync lands. It outlives the chat screen (the
// QueryClient is app-wide, the screen is not), so leaving it behind means a
// later read of it describes a thread from before the last few edits.
// Keyed by the thread's owner, so a sync that lands after an account change
// can only ever touch the previous owner's entry.
function refreshSyncedCache(thread: ChatMessage[], ownerId: string) {
  if (queryClient.getQueryData(chatThreadQueryKey(ownerId))) {
    queryClient.setQueryData(chatThreadQueryKey(ownerId), thread);
  }
}

// ⚠️ The upload goes out under whoever is signed in NOW (apiClient attaches
// the current bearer), so a thread is only ever sent while its owner is that
// User. Without this, a thread left behind by one account — restored from
// AsyncStorage on launch, or written to by a reply that landed after a switch
// — was pushed into the next account's server copy.
function ownedBySession(ownerId: string | null): ownerId is string {
  return ownerId !== null && ownerId === userIdFromAccessToken(useSessionStore.getState().accessToken);
}

function scheduleSync(getState: () => ChatState) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const { thread, ownerId } = getState();
    if (!thread.length || !ownedBySession(ownerId)) return;
    // Best-effort — a failed sync (offline, expired session) just leaves the
    // next mutation to reschedule it; settings.tsx's logout flush gets one
    // more attempt before the local copy is wiped.
    syncChatThreadRequest(thread)
      .then(() => refreshSyncedCache(thread, ownerId))
      .catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

interface ChatState {
  thread: ChatMessage[];
  // The User this thread belongs to — persisted with it, because AsyncStorage
  // is per device, not per account. Set by clear(userId) when a User enters
  // and checked by claimFor() when a session is restored on launch.
  ownerId: string | null;
  // The User whose server copy has already been restored into this thread,
  // this app run. Not persisted. Replaces the chat screen's old "was the
  // thread empty when I mounted" flag, which went stale once tabs stopped
  // unmounting: the screen now stays mounted across account changes.
  restoredFor: string | null;
  // Bumped by every clear(). Work that writes to the thread after an await
  // compares it (captureChatEpoch) to drop a reply that outlived the session
  // it was asked in.
  epoch: number;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  // Drops in a thread fetched from GET /ai/chat/thread (ai-chat.tsx) — not
  // merged with scheduleSync, since restoring server state is not itself a
  // local change that needs re-syncing.
  //
  // ⚠️ Ignored unless the local thread is EMPTY. This is a restore path for a
  // device that has nothing, never a merge: the local copy is always the newer
  // one (every local edit syncs UP to the server, seconds after the fact).
  // Also ignored unless `userId` owns the thread, and it marks the restore as
  // done for that User either way.
  hydrateThread: (messages: ChatMessage[], userId: string) => void;
  /** Empties the thread and hands it to `ownerId` (null = nobody signed in). */
  clear: (ownerId?: string | null) => void;
  /** A session restored on launch: keeps the persisted thread only if it is this User's. */
  claimFor: (userId: string) => void;
  // Best-effort immediate flush — settings.tsx awaits this (capped by its own
  // short timeout) before logout clears the local copy, so the last few
  // seconds of activity still sitting in the debounce timer aren't lost.
  flushSync: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      thread: [],
      ownerId: null,
      restoredFor: null,
      epoch: 0,
      addMessage: (message) => {
        set((state) => ({ thread: [...state.thread, message] }));
        scheduleSync(get);
      },
      updateMessage: (id, patch) => {
        set((state) => ({ thread: state.thread.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
        scheduleSync(get);
      },
      removeMessage: (id) => set((state) => ({ thread: state.thread.filter((m) => m.id !== id) })),
      // ⚠️ Guarded in the store rather than at the call site, because the call
      // site cannot see the danger: TanStack keeps the GET's result cached for
      // minutes after the chat screen unmounts, so ai-chat.tsx's mount effect
      // fires again — with a pre-edit server snapshot — every time the user
      // leaves the tab and comes back. That is how a deleted transaction's
      // tombstone came back to life as a live card: nothing had failed, the
      // stale fetch simply overwrote the thread that held the tombstone.
      hydrateThread: (messages, userId) =>
        set((state) => {
          if (state.ownerId !== userId) return state;
          return { restoredFor: userId, thread: state.thread.length === 0 ? messages : state.thread };
        }),
      clear: (ownerId = null) => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        set((state) => ({ thread: [], ownerId, restoredFor: null, epoch: state.epoch + 1 }));
      },
      // A thread persisted before owners were recorded has none, and is
      // dropped too: it may well be the previous account's (the server copy
      // brings this User's own thread back).
      claimFor: (userId) => {
        if (get().ownerId !== userId) get().clear(userId);
      },
      flushSync: async () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        const { thread, ownerId } = get();
        if (!thread.length || !ownedBySession(ownerId)) return;
        await syncChatThreadRequest(thread);
        refreshSyncedCache(thread, ownerId);
      },
    }),
    {
      name: "pfm_chat_thread",
      storage: createJSONStorage(() => AsyncStorage),
      // restoredFor and epoch describe this app run only.
      partialize: (state) => ({ thread: state.thread, ownerId: state.ownerId }),
      // Called after a successful read and after a failed one alike.
      onRehydrateStorage: () => markThreadRestored,
    },
  ),
);

export function useChatThreadRestored(): boolean {
  return useSyncExternalStore(subscribeThreadRestored, () => threadRestored);
}

/**
 * For work that writes to the thread after an await (an AI reply, a consult
 * answer): returns a check that is true only while the thread is still the
 * one the work started on. A reply that lands after a logout or an account
 * switch belongs to the previous session and must be dropped — written into
 * the new User's thread it showed up there, and blocked their server copy
 * from being restored.
 */
export function captureChatEpoch(): () => boolean {
  const started = useChatStore.getState().epoch;
  return () => useChatStore.getState().epoch === started;
}
