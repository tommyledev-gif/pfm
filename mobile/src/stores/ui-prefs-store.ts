import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_LANGUAGE, Language, isLanguage } from "@/locales/languages";

export type HomePeriod = "day" | "month" | "year";
// The Wallets screen's two tabs: the User's own wallets, or "shared" — the
// Ví chung tab, invitations and every shared wallet, kept out of the card
// stack of the User's own wallets.
export type WalletsTab = "own" | "shared";
// How the own tab draws them, picked from the header's popover: the card
// carousel Home also shows (the default), or the vertical list grouped by
// wallet type.
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
  walletsTab: WalletsTab;
  setWalletsTab: (tab: WalletsTab) => void;
  walletsViewMode: WalletsViewMode;
  setWalletsViewMode: (mode: WalletsViewMode) => void;
  // Settings' "Ghim vị trí khi tạo giao dịch": where each new Transaction
  // form's own location switch starts. The form can still turn it off for the
  // one it is filling in without touching this.
  pinLocationByDefault: boolean;
  setPinLocationByDefault: (enabled: boolean) => void;
  // The app's UI language (specs/mobile-language-switch D-04): per device,
  // so sign-out, an account switch and a PIN lockout leave it alone — this
  // store is not session-scoped. lib/i18n.ts follows it.
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      homePeriod: "day",
      setHomePeriod: (period) => set({ homePeriod: period }),
      debugBubbleVisible: false, // 1. Sửa mặc định thành false ở đây
      setDebugBubbleVisible: (visible) => set({ debugBubbleVisible: visible }),
      walletsTab: "own",
      setWalletsTab: (tab) => set({ walletsTab: tab }),
      walletsViewMode: "carousel",
      setWalletsViewMode: (mode) => set({ walletsViewMode: mode }),
      pinLocationByDefault: true,
      setPinLocationByDefault: (enabled) => set({ pinLocationByDefault: enabled }),
      language: DEFAULT_LANGUAGE,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "pfm_ui_prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // ⚠️ Ghi chú của hệ thống: Phải nâng version để clear bộ nhớ cũ
      // v4: language — every existing install starts in Vietnamese (BR-02).
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as Partial<UiPrefsState> | undefined;
        if (!state) return state;

        let homePeriod = state.homePeriod as string | undefined;
        let debugBubbleVisible = state.debugBubbleVisible; // Lấy giá trị cũ ra

        if (homePeriod === "week") homePeriod = "day";
        if (version < 2 && homePeriod === "month") homePeriod = "day";
        
        // 3. Nếu nâng từ phiên bản nhỏ hơn 3 lên, ép nó thành false luôn
        if (version < 3) {
          debugBubbleVisible = false;
        }

        return {
          ...state,
          homePeriod: (homePeriod ?? "day") as HomePeriod,
          debugBubbleVisible: debugBubbleVisible ?? false,
          language: isLanguage(state.language) ? state.language : DEFAULT_LANGUAGE,
        };
      },
      // migrate only runs across versions: a v4 store holding a language this
      // build does not have (a newer build's, a hand-edited value) is caught
      // here and read as the default (BR-01).
      // Also every load: "shared" was a third view mode before the Wallets
      // screen had two tabs, and reads as that tab with the cards.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<UiPrefsState> | undefined) };
        if ((state.walletsViewMode as string) === "shared") {
          state.walletsViewMode = "carousel";
          state.walletsTab = "shared";
        }
        return isLanguage(state.language) ? state : { ...state, language: DEFAULT_LANGUAGE };
      },
    },
  ),
);


const subscribeHydration = (onChange: () => void) => useUiPrefsStore.persist.onFinishHydration(onChange);
const getHydrated = () => useUiPrefsStore.persist.hasHydrated();

/**
 * Whether the saved prefs have been read back (AsyncStorage, asynchronous).
 * The root layout holds the splash for it: Home rendered with the default
 * period first and then slid over to the saved one on its very first frame.
 */
export function useUiPrefsHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrated);
}
