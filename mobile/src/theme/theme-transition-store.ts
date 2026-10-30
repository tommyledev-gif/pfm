import { create } from "zustand";

import { Language } from "@/locales/languages";
import { ThemeName } from "@/theme/palettes";

/** What changes beneath the snapshot: the theme, or the app language. */
export type PendingChange = { kind: "theme"; theme: ThemeName } | { kind: "language"; language: Language };

// Hand-off between useSwitchTheme() / useSwitchLanguage() (which take the
// snapshot) and ThemeTransitionHost (which shows it, applies the change
// underneath and fades it out). Not persisted — a transition never outlives
// the process.
interface ThemeTransitionState {
  // The snapshot of the screen as it looked before the change, while the
  // cross-fade is running; null otherwise.
  snapshotUri: string | null;
  // Applied by the host once the snapshot is actually painted, so the swap
  // underneath is never visible.
  pending: PendingChange | null;
  begin: (snapshotUri: string, change: PendingChange) => void;
  end: () => void;
}

export const useThemeTransitionStore = create<ThemeTransitionState>()((set) => ({
  snapshotUri: null,
  pending: null,
  begin: (snapshotUri, change) => set({ snapshotUri, pending: change }),
  end: () => set({ snapshotUri: null, pending: null }),
}));
