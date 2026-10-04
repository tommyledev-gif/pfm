import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { create } from "zustand";

import { refreshTokenRequest } from "@/features/auth/api/use-refresh-mutation";
import { roleFromAccessToken, userIdFromAccessToken, type UserRole } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import {
  cancelScheduledRefresh,
  markRefreshDue,
  remainingDelayMs,
  scheduleRefresh,
} from "@/lib/refresh-scheduler";
import { secureStorage } from "@/lib/secure-storage";
import { useToastStore } from "@/stores/toast-store";
import {
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_EMAIL_KEY,
  SECURE_STORE_ISSUED_AT_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
  REFRESH_RETRY_DELAY_SECONDS,
} from "@/lib/constants";

// The server answered and refused the refresh token (expired, revoked,
// malformed, User disabled) — the only failure that really ends a session.
function isRefreshRejected(err: unknown): boolean {
  const status = isAxiosError(err) ? err.response?.status : undefined;
  return status === 400 || status === 401 || status === 403;
}

// Every scheduled renewal (proactive, post-hydration, retry) goes through
// here. Offline it does nothing: the renewal stays due in refresh-scheduler,
// and session-resume.ts sends it the moment connectivity returns — so no
// renewal request is ever fired into a known-offline network
// (specs/mobile-offline-support AC-OFF-03, BR-OFF-P01).
function runDueRefresh(): void {
  if (!onlineManager.isOnline()) return;
  useSessionStore.getState().refreshSession().catch(() => {});
}

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
  // Derived from the access token's own claims, never stored separately —
  // the login/refresh responses don't carry it and there's no GET /users/me
  // (see lib/jwt.ts). Kept in the store rather than decoded at each call
  // site so a screen can select it like any other session field. null means
  // "unknown" and is treated as the least-privileged case by every consumer.
  role: UserRole | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, email: string) => Promise<void>;
  clear: () => Promise<void>;
  // Refreshes the current session, de-duplicated across concurrent callers
  // (see the module-level refreshPromise above). Resolves with the new
  // access token. Rejects on any failure, but force-clears the session
  // (spec.md decision #5) only when the server refused the token — a
  // network/server failure keeps the session and schedules a retry.
  refreshSession: () => Promise<string>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  email: null,
  role: null,
  isHydrated: false,

  async hydrate() {
    const [accessToken, refreshToken, email, issuedAtRaw] = await Promise.all([
      secureStorage.getItem(SECURE_STORE_ACCESS_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_REFRESH_TOKEN_KEY),
      secureStorage.getItem(SECURE_STORE_EMAIL_KEY),
      secureStorage.getItem(SECURE_STORE_ISSUED_AT_KEY),
    ]);
    set({ accessToken, refreshToken, email, role: roleFromAccessToken(accessToken), isHydrated: true });

    if (!accessToken) return;
    // No stored issuedAt (e.g. a session persisted before this feature
    // shipped) is treated as "already due" — the safe default, since we
    // have no better information (S-REF-13).
    const issuedAtMs = issuedAtRaw ? Number(issuedAtRaw) : 0;
    scheduleRefresh(runDueRefresh, remainingDelayMs(issuedAtMs));
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
    // Only when the User actually changes: a proactive rotation (every ~12
    // min) keeps the same User, and clearing there wiped the whole cache
    // mid-session for nothing.
    const previousUserId = userIdFromAccessToken(get().accessToken);
    if (previousUserId === null || previousUserId !== userIdFromAccessToken(accessToken)) {
      queryClient.clear();
    }
    set({ accessToken, refreshToken, email, role: roleFromAccessToken(accessToken) });

    // Every new pair (login, activate, or a rotation) reschedules the next
    // proactive refresh from scratch — never stacked with a prior pending
    // timer (specs/mobile-session-refresh/spec.md Edge Case #3).
    scheduleRefresh(runDueRefresh);
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
    set({ accessToken: null, refreshToken: null, email: null, role: null });
  },

  refreshSession() {
    if (refreshPromise) return refreshPromise;

    const { refreshToken, email, setTokens, clear } = get();
    if (!refreshToken) {
      return Promise.reject(new Error("no refresh token to refresh with"));
    }

    // Stale-result guard (specs/mobile-account-switch plan.md Finding #4):
    // an account switch, add-account or "sign out everywhere" can replace
    // the session while this request is in flight. Its late answer then
    // belongs to a session that is gone — committing it would silently
    // switch back to the previous User, and its refusal must not clear the
    // new User's session. Both paths only act while the session still holds
    // the refresh token this request was made with.
    const isStale = () => get().refreshToken !== refreshToken;
    refreshPromise = refreshTokenRequest(refreshToken)
      .then(async (pair) => {
        // Rejecting (not answering with the new User's token) also stops a
        // request of the previous User from being retried as the new one.
        if (isStale()) throw new Error("session changed during refresh");
        await setTokens(pair.access_token, pair.refresh_token, email ?? "");
        return pair.access_token;
      })
      .catch(async (err) => {
        if (isStale()) throw err;
        // Offline, timeout or a 5xx says nothing about the refresh token
        // itself — keep the session (the app works from cache and the next
        // request/foreground retries) instead of logging the User out.
        // The renewal stays owed (markRefreshDue) so session-resume.ts
        // renews at once on reconnect / foreground instead of waiting out
        // the retry delay.
        if (!isRefreshRejected(err)) {
          scheduleRefresh(runDueRefresh, REFRESH_RETRY_DELAY_SECONDS * 1000);
          markRefreshDue();
          throw err;
        }
        await clear();
        // Only this path (the refresh token itself was rejected — expired or
        // revoked) counts as a session actually "ending" out from under the
        // user; an explicit Log out on Settings also calls clear() but
        // already knows why it's happening, so it doesn't need telling.
        useToastStore.getState().show("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  },
}));
