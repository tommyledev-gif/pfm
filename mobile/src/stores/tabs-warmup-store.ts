import { create } from "zustand";

interface TabsWarmupState {
  /** Every bottom-nav tab is mounted and the JS thread has gone quiet after it. */
  warm: boolean;
  markWarm: () => void;
}

// Ephemeral (never persisted). The launch splash (BrandSplash, app/_layout.tsx)
// holds until this is set, so the tabs mount beneath it instead of while the
// user is already tapping the nav (app/(app)/(tabs)/_layout.tsx). Stays set
// for the rest of the run: a later sign-in or account switch remounts the tabs
// behind its own overlays, not behind the launch splash.
export const useTabsWarmupStore = create<TabsWarmupState>((set) => ({
  warm: false,
  markWarm: () => set({ warm: true }),
}));
