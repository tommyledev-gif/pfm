import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HomePeriod = "week" | "month" | "year";

// Small persisted UI-preferences store — currently just the Home screen's
// selected Week/Month/Year snapshot period, so it survives navigation and
// app restarts instead of resetting to Month every time. AsyncStorage (not
// expo-secure-store) since this is non-sensitive UI state, same reasoning
// as chat-store.ts's own storage choice.
interface UiPrefsState {
  homePeriod: HomePeriod;
  setHomePeriod: (period: HomePeriod) => void;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      homePeriod: "month",
      setHomePeriod: (period) => set({ homePeriod: period }),
    }),
    {
      name: "pfm_ui_prefs",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
