import { create } from "zustand";

import { ThemeName } from "@/theme/palettes";

// Hand-off between useSwitchTheme() (which takes the snapshot) and
// ThemeTransitionHost (which shows it, swaps the theme underneath and fades
// it out). Not persisted — a transition never outlives the process.
interface ThemeTransitionState {
  // The snapshot of the screen as it looked in the old theme, while the
  // cross-fade is running; null otherwise.
  snapshotUri: string | null;
  // Applied by the host once the snapshot is actually painted, so the swap
  // underneath is never visible.
  pendingTheme: ThemeName | null;
  begin: (snapshotUri: string, theme: ThemeName) => void;
  end: () => void;
}

export const useThemeTransitionStore = create<ThemeTransitionState>()((set) => ({
  snapshotUri: null,
  pendingTheme: null,
  begin: (snapshotUri, theme) => set({ snapshotUri, pendingTheme: theme }),
  end: () => set({ snapshotUri: null, pendingTheme: null }),
}));
