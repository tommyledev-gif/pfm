import { create } from "zustand";

// Client-side mirror of "who's logged in" for display only — the session
// itself lives in the httpOnly cookie (lib/constants.ts SESSION_COOKIE_NAME)
// and is enforced server-side by middleware.ts + the Go backend, never here.
interface AuthState {
  userEmail: string | null;
  setUserEmail: (email: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userEmail: null,
  setUserEmail: (email) => set({ userEmail: email }),
  clear: () => set({ userEmail: null }),
}));
