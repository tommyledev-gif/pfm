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
  // Settings' "Ghim vị trí khi tạo giao dịch": where each new Transaction
  // form's own location switch starts. The form can still turn it off for the
  // one it is filling in without touching this.
  pinLocationByDefault: boolean;
  setPinLocationByDefault: (enabled: boolean) => void;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      homePeriod: "day",
      setHomePeriod: (period) => set({ homePeriod: period }),
      debugBubbleVisible: false, // 1. Sửa mặc định thành false ở đây
      setDebugBubbleVisible: (visible) => set({ debugBubbleVisible: visible }),
      walletsViewMode: "carousel",
      setWalletsViewMode: (mode) => set({ walletsViewMode: mode }),
      pinLocationByDefault: true,
      setPinLocationByDefault: (enabled) => set({ pinLocationByDefault: enabled }),
    }),
    {
      name: "pfm_ui_prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // ⚠️ Ghi chú của hệ thống: Phải nâng version để clear bộ nhớ cũ
      version: 3, // 2. Tăng từ 2 lên 3
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
          debugBubbleVisible: debugBubbleVisible ?? false 
        };
      },
    },
  ),
);

