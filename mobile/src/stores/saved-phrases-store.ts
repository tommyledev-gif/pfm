import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { NO_PHRASES, PhrasesByUser, StoredPhrase, samePhrase } from "@/stores/phrase-list";

// Phrases the User chose to keep. Capped, and a full list refuses new ones
// rather than dropping an old one — these were kept on purpose.
export const MAX_SAVED_PHRASES = 20;

export type SavePhraseResult = "saved" | "duplicate" | "full";

interface SavedPhrasesState {
  byUser: PhrasesByUser;
  save: (userId: string, text: string) => SavePhraseResult;
  remove: (userId: string, text: string) => void;
  /** Drops every phrase of a User removed from this device. */
  removeUser: (userId: string) => void;
}

/**
 * Saved phrases, per User, on this device only. Keyed by user id so another
 * User signing in on the same phone never sees them; deliberately NOT cleared
 * on logout, so the same User finds them again after signing back in.
 */
export const useSavedPhrasesStore = create<SavedPhrasesState>()(
  persist(
    (set, get) => ({
      byUser: {},
      save: (userId, text) => {
        const trimmed = text.trim();
        const list = get().byUser[userId] ?? NO_PHRASES;
        if (list.some((p) => samePhrase(p.text, trimmed))) return "duplicate";
        if (list.length >= MAX_SAVED_PHRASES) return "full";
        set((s) => ({ byUser: { ...s.byUser, [userId]: [{ text: trimmed, at: Date.now() }, ...list] } }));
        return "saved";
      },
      remove: (userId, text) =>
        set((s) => ({
          byUser: {
            ...s.byUser,
            [userId]: (s.byUser[userId] ?? NO_PHRASES).filter((p) => !samePhrase(p.text, text)),
          },
        })),
      removeUser: (userId) =>
        set((s) => {
          const { [userId]: _dropped, ...rest } = s.byUser;
          return { byUser: rest };
        }),
    }),
    { name: "pfm_saved_phrases", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useSavedPhrases(userId: string | null): StoredPhrase[] {
  return useSavedPhrasesStore((s) => (userId ? s.byUser[userId] ?? NO_PHRASES : NO_PHRASES));
}
