import { create } from "zustand";

export type ToastVariant = "error" | "warning" | "info";

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  // Bumped on every show() (even while a toast is already visible) so
  // Toast.tsx can key its slide-in animation/5s auto-dismiss timer off a
  // value that always changes, instead of off `visible` alone — a second
  // show() while one is already up must restart the timer, not be a no-op.
  token: number;
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
}

let nextToken = 0;

// Single global toast (no queue) — mounted once as <Toast /> in
// app/_layout.tsx, same pattern as DebugBubble/NavigationLogger, so any
// screen can call useToastStore.getState().show(...) without prop-drilling.
export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: "",
  variant: "info",
  token: 0,
  show: (message, variant = "info") => set({ visible: true, message, variant, token: ++nextToken }),
  hide: () => set({ visible: false }),
}));
