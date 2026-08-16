import { create } from "zustand";

import { secureStorage } from "@/lib/secure-storage";
import {
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_EMAIL_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
} from "@/lib/constants";

// Global session state (dev.md: "Client/global state -> Zustand... auth
// session" — the same reasoning that puts this in frontend/'s top-level
// src/stores/, not nested under features/auth/). Route guards (app/(app)/
// _layout.tsx) and the axios interceptor (lib/axios.ts) both read this
// directly, so it can't live inside a single feature's own folder.
//
// isHydrated distinguishes "we haven't checked secure storage yet" from
// "checked, and there's no session" — without it, a route guard would
// flash the login screen for a split second on every cold start while the
// async secure-store read is still in flight.
interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, email: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  email: null,
  isHydrated: false,

  async hydrate() {
    const [accessToken, refreshToken, email] = await Promise.all([
      secureStorage.getItem(SECURE_STORE_ACCESS_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_REFRESH_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_EMAIL_KEY),
    ]);
    set({ accessToken, refreshToken, email, isHydrated: true });
  },

  async setTokens(accessToken, refreshToken, email) {
    await Promise.all([
      secureStorage.setItem(SECURE_STORE_ACCESS_TOKEN_KEY, accessToken),
      secureStorage.setItem(SECURE_STORE_REFRESH_TOKEN_KEY, refreshToken),
      secureStorage.setItem(SECURE_STORE_EMAIL_KEY, email),
    ]);
    set({ accessToken, refreshToken, email });
  },

  async clear() {
    await Promise.all([
      secureStorage.removeItem(SECURE_STORE_ACCESS_TOKEN_KEY),
      secureStorage.removeItem(SECURE_STORE_REFRESH_TOKEN_KEY),
      secureStorage.removeItem(SECURE_STORE_EMAIL_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, email: null });
  },
}));
