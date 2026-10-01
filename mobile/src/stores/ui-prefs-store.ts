import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HomePeriod = "day" | "month" | "year";
// The Wallets screen's two layouts: the card carousel Home also shows (the
// default), or the vertical list grouped by wallet type.
export type WalletsViewMode = "carousel" | "list";

// Small persisted UI-preferences store — currently just the Home screen's
// selected Day/Month/Year snapshot period, so it survives navigation and
// app restarts instead of resetting every time. AsyncStorage (not
// expo-secure-store) since this is non-sensitive UI state, same reasoning
// as chat-store.ts's own storage choice.
interface UiPrefsState {
  homePeriod: HomePeriod;
  setHomePeriod: (period: HomePeriod) => void;
  // Developer screen's "Show debug bubble" toggle (settings.tsx → Developer
  // row). Only hides DebugBubble's own draggable UI — logging itself
  // (axios.ts's interceptors, global-error-logger.ts, NavigationLogger) runs
  // independently of this flag and is never affected by it.
  debugBubbleVisible: boolean;
  setDebugBubbleVisible: (visible: boolean) => void;
  walletsViewMode: WalletsViewMode;
  setWalletsViewMode: (mode: WalletsViewMode) => void;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      homePeriod: "day",
      setHomePeriod: (period) => set({ homePeriod: period }),
      debugBubbleVisible: true,
      setDebugBubbleVisible: (visible) => set({ debugBubbleVisible: visible }),
      // A key missing from older persisted state takes this default at
      // rehydration (persist's shallow merge), so no version bump is owed.
      walletsViewMode: "carousel",
      setWalletsViewMode: (mode) => set({ walletsViewMode: mode }),
    }),
    {
      name: "pfm_ui_prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // ⚠️ Changing the default above is NOT enough on its own: a persisted
      // value always wins over it at rehydration, so every existing install
      // would keep landing on whatever it last stored. The default only reaches
      // anyone through a version bump.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<UiPrefsState> | undefined;
        if (!state) return state;

        let homePeriod = state.homePeriod as string | undefined;

        // "week" was removed from the selector. Left alone it rehydrates into a
        // period no tab can represent: nothing highlighted, and a range the user
        // has no control to switch away from.
        if (homePeriod === "week") homePeriod = "day";

        // A "month" stored before v2 was the old DEFAULT, not a choice — the
        // Ngày tab did not exist yet, so nobody could have preferred month over
        // it. Moving those installs once is what actually makes Ngày the
        // default; from here on their own selection is remembered again.
        if (version < 2 && homePeriod === "month") homePeriod = "day";

        return { ...state, homePeriod: (homePeriod ?? "day") as HomePeriod };
      },
    },
  ),
);
