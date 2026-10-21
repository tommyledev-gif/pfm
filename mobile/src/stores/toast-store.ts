import { create } from "zustand";

export type ToastVariant = "error" | "warning" | "info" | "success";

export interface ToastAction {
  /** The coloured line under the message, naming what a tap does ("Hoàn tác"). */
  label: string;
  /** Runs on tap; the toast closes right after. */
  onPress: () => void;
}

export interface ToastOptions {
  /** A short first line above the message. */
  title?: string;
  action?: ToastAction;
}

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  title: string | null;
  action: ToastAction | null;
  // Bumped on every show() (even while a toast is already visible) so
  // Toast.tsx can key its entrance/auto-dismiss clock off a value that always
  // changes, instead of off `visible` alone — a second show() while one is
  // already up must restart the clock, not be a no-op.
  token: number;
  show: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  /**
   * With a token, hides only if that toast is still the current one: an exit
   * animation finishing after a newer show() must not take the new one down.
   */
  hide: (token?: number) => void;
}

let nextToken = 0;

// Single global toast (no queue) — mounted once as <Toast /> in
// app/_layout.tsx, same pattern as DebugBubble/NavigationLogger, so any
// screen can call useToastStore.getState().show(...) without prop-drilling.
export const useToastStore = create<ToastState>((set, get) => ({
  visible: false,
  message: "",
  variant: "info",
  title: null,
  action: null,
  token: 0,
  show: (message, variant = "info", options) =>
    set({
      visible: true,
      message,
      variant,
      title: options?.title ?? null,
      action: options?.action ?? null,
      token: ++nextToken,
    }),
  hide: (token) => {
    if (token !== undefined && token !== get().token) return;
    set({ visible: false });
  },
}));
