import { create } from "zustand";

import { refreshTokenRequest } from "@/features/auth/api/use-refresh-mutation";
import { queryClient } from "@/lib/query-client";
import { cancelScheduledRefresh, remainingDelayMs, scheduleRefresh } from "@/lib/refresh-scheduler";
import { secureStorage } from "@/lib/secure-storage";
import {
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_EMAIL_KEY,
  SECURE_STORE_ISSUED_AT_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
} from "@/lib/constants";

// Module-level, not store state — a single in-flight refresh must be shared
// by every caller (the proactive timer below and lib/axios.ts's reactive
// 401 handler both call useSessionStore.getState().refreshSession()), so
// concurrent triggers collapse into exactly one POST /auth/refresh
// (specs/mobile-session-refresh/spec.md decision #4, S-REF-11).
let refreshPromise: Promise<string> | null = null;

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
  // Refreshes the current session, de-duplicated across concurrent callers
  // (see the module-level refreshPromise above). Resolves with the new
  // access token; on any failure it force-clears the session (spec.md
  // decision #5) and rejects.
  refreshSession: () => Promise<string>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  email: null,
  isHydrated: false,

  async hydrate() {
    const [accessToken, refreshToken, email, issuedAtRaw] = await Promise.all([
      secureStorage.getItem(SECURE_STORE_ACCESS_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_REFRESH_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_EMAIL_KEY),
      secureStorage.getItem(SECURE_STORE_ISSUED_AT_KEY),
    ]);
    set({ accessToken, refreshToken, email, isHydrated: true });

    if (!accessToken) return;
    // No stored issuedAt (e.g. a session persisted before this feature
    // shipped) is treated as "already due" — the safe default, since we
    // have no better information (S-REF-13).
    const issuedAtMs = issuedAtRaw ? Number(issuedAtRaw) : 0;
    scheduleRefresh(() => {
      get().refreshSession().catch(() => {});
    }, remainingDelayMs(issuedAtMs));
  },

  async setTokens(accessToken, refreshToken, email) {
    const issuedAtMs = Date.now();
    await Promise.all([
      secureStorage.setItem(SECURE_STORE_ACCESS_TOKEN_KEY, accessToken),
      secureStorage.setItem(SECURE_STORE_REFRESH_TOKEN_KEY, refreshToken),
      secureStorage.setItem(SECURE_STORE_EMAIL_KEY, email),
      secureStorage.setItem(SECURE_STORE_ISSUED_AT_KEY, String(issuedAtMs)),
    ]);
    // Every cached query (wallets, transactions, budgets, ...) is keyed
    // globally, never per-user — without this, logging in as a different
    // account renders the previous account's cached data for a moment
    // before the first refetch overwrites it. Cleared before the session
    // state flips so no protected screen can mount against stale data.
    queryClient.clear();
    set({ accessToken, refreshToken, email });

    // Every new pair (login, activate, or a rotation) reschedules the next
    // proactive refresh from scratch — never stacked with a prior pending
    // timer (specs/mobile-session-refresh/spec.md Edge Case #3).
    scheduleRefresh(() => {
      get().refreshSession().catch(() => {});
    });
  },

  async clear() {
    cancelScheduledRefresh();
    await Promise.all([
      secureStorage.removeItem(SECURE_STORE_ACCESS_TOKEN_KEY),
      secureStorage.removeItem(SECURE_STORE_REFRESH_TOKEN_KEY),
      secureStorage.removeItem(SECURE_STORE_EMAIL_KEY),
      secureStorage.removeItem(SECURE_STORE_ISSUED_AT_KEY),
    ]);
    queryClient.clear();
    set({ accessToken: null, refreshToken: null, email: null });
  },

  refreshSession() {
    if (refreshPromise) return refreshPromise;

    const { refreshToken, email, setTokens, clear } = get();
    if (!refreshToken) {
      return Promise.reject(new Error("no refresh token to refresh with"));
    }

    refreshPromise = refreshTokenRequest(refreshToken)
      .then(async (pair) => {
        await setTokens(pair.access_token, pair.refresh_token, email ?? "");
        return pair.access_token;
      })
      .catch(async (err) => {
        await clear();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  },
}));
