import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HomePeriod = "day" | "month" | "year";

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
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      homePeriod: "day",
      setHomePeriod: (period) => set({ homePeriod: period }),
      debugBubbleVisible: true,
      setDebugBubbleVisible: (visible) => set({ debugBubbleVisible: visible }),
    }),
    {
      name: "pfm_ui_prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // "week" was replaced by "day". Anyone who had Week selected already has
      // it on disk, and without this they would rehydrate into a period the
      // selector no longer offers: no tab highlighted, and a range nothing can
      // switch away from.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<UiPrefsState> | undefined;
        if (state && (state.homePeriod as string) === "week") {
          return { ...state, homePeriod: "day" as HomePeriod };
        }
        return state;
      },
    },
  ),
);
