import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { applyPalette } from "@/theme/active-palette";
import { DEFAULT_THEME, THEMES, ThemeName } from "@/theme/palettes";

// The selected theme, persisted per device. Its own store rather than a
// field on ui-prefs-store: the root layout waits for THIS hydration before
// dropping the splash (a returning light-theme user must never see a dark
// first frame), and should not wait on unrelated prefs to do it.
//
// Switching with animation goes through useThemeTransition() — setThemeName
// is the instant, un-animated swap it performs underneath the snapshot.
interface ThemeState {
  themeName: ThemeName;
  isHydrated: boolean;
  setThemeName: (name: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: DEFAULT_THEME,
      isHydrated: false,
      setThemeName: (name) => {
        // Before set(): the re-render set() triggers must already see the
        // new values in the live `colors` object.
        applyPalette(name);
        set({ themeName: name });
      },
    }),
    {
      name: "pfm_theme",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state, error) => {
        // A theme removed in a later build must not rehydrate into a name
        // with no palette behind it.
        const name = !error && state && state.themeName in THEMES ? state.themeName : DEFAULT_THEME;
        applyPalette(name);
        useThemeStore.setState({ themeName: name, isHydrated: true });
      },
    },
  ),
);
