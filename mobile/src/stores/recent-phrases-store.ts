import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { NO_PHRASES, PhrasesByUser, StoredPhrase, moveToFront } from "@/stores/phrase-list";

// Recent phrases are history, not a choice: the oldest simply falls off.
export const RECENT_PHRASES_LIMIT = 50;

interface RecentPhrasesState {
  byUser: PhrasesByUser;
  record: (userId: string, text: string) => void;
}

/**
 * The recording messages that produced a Transaction the User then confirmed,
 * newest first, per User, on this device only. Written from the one place
 * every confirm goes through (useConfirmProposal), so a discarded proposal
 * never becomes a suggestion.
 */
export const useRecentPhrasesStore = create<RecentPhrasesState>()(
  persist(
    (set) => ({
      byUser: {},
      record: (userId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((s) => ({
          byUser: {
            ...s.byUser,
            [userId]: moveToFront(s.byUser[userId] ?? NO_PHRASES, trimmed, Date.now()).slice(0, RECENT_PHRASES_LIMIT),
          },
        }));
      },
    }),
    { name: "pfm_recent_phrases", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useRecentPhrases(userId: string | null): StoredPhrase[] {
  return useRecentPhrasesStore((s) => (userId ? s.byUser[userId] ?? NO_PHRASES : NO_PHRASES));
}
