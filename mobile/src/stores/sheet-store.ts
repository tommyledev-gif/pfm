import { create } from "zustand";

interface SheetState {
  openCount: number;
  open: () => void;
  close: () => void;
}

// Ephemeral (never persisted) counter of how many Drawer-based bottom sheets
// are currently mounted+visible — lets app/(app)/_layout.tsx hide the
// floating BottomNav while one is open. Drawer no longer renders through
// RN's <Modal> (see Drawer.tsx for why), so it no longer gets a separate
// always-on-top window for free; this is how it still paints above
// BottomNav, which lives in a completely different part of the tree.
// A counter, not a boolean, because a Drawer-based form can show its own
// ConfirmDialog on top without ever setting the Drawer's own `visible` to
// false — nothing here assumes only one sheet is ever open at once.
export const useSheetStore = create<SheetState>((set) => ({
  openCount: 0,
  open: () => set((s) => ({ openCount: s.openCount + 1 })),
  close: () => set((s) => ({ openCount: Math.max(0, s.openCount - 1) })),
}));
