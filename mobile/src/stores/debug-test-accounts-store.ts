import { create } from "zustand";

interface DebugTestAccountsState {
  /** lib/dev-login.ts's TEST_ACCOUNTS are listed on the login screen. */
  shown: boolean;
  /** The login screen should open its saved-accounts view, once. */
  revealPending: boolean;
  /** The debug console's "Test accounts": list them and open that view. */
  reveal: () => void;
  consumeReveal: () => void;
}

/**
 * Debug-console state for switching test accounts quickly. In memory only:
 * the list stays on the login screen until the app restarts, never longer.
 */
export const useDebugTestAccountsStore = create<DebugTestAccountsState>((set) => ({
  shown: false,
  revealPending: false,
  reveal: () => set({ shown: true, revealPending: true }),
  consumeReveal: () => set({ revealPending: false }),
}));
