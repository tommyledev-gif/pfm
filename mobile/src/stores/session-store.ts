import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { create } from "zustand";

import { refreshTokenRequest } from "@/features/auth/api/use-refresh-mutation";
import { accountTokens } from "@/lib/account-tokens";
import { roleFromAccessToken, userIdFromAccessToken, type UserRole } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { detachQueryPersistence } from "@/lib/query-persistence/query-persistence";
import {
  cancelScheduledRefresh,
  markRefreshDue,
  remainingDelayMs,
  scheduleRefresh,
} from "@/lib/refresh-scheduler";
import { i18n, TranslationKey } from "@/lib/i18n";
import { secureStorage } from "@/lib/secure-storage";
import { emitSessionRefused, emitSessionRenewed } from "@/lib/session-events";
import { useToastStore } from "@/stores/toast-store";
import {
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_EMAIL_KEY,
  SECURE_STORE_ISSUED_AT_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
  REFRESH_RETRY_DELAY_SECONDS,
} from "@/lib/constants";

const SESSION_ENDED_MESSAGE = "errors.sessionExpired" satisfies TranslationKey;
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

// ⚠️ setTokens() and clear() run one at a time, in call order. Both await
// secure storage (and a cache detach) before they set the state, and two
// commits interleaving could land in either order: a renewal of the OUTGOING
// User finishing during an account switch overwrote the new User's tokens
// with the old ones, the switch then logged that old session out, and the
// next request sent the User to the login screen instead of the account
// they picked. Queued, a commit that must only apply to a given session
// (onlyIfRefreshToken) can check it at its turn, right before it writes.
let commitQueue: Promise<unknown> = Promise.resolve();

function queueCommit<T>(commit: () => Promise<T>): Promise<T> {
  const run = commitQueue.then(commit, commit);
  commitQueue = run.catch(() => {});
  return run;
}

/** A commit that was for a session that has since been replaced or ended. */
class StaleSessionError extends Error {}

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
  // onlyIfRefreshToken: commit only while the session still holds this
  // refresh token (a renewal of it), else reject with nothing written.
  setTokens: (
    accessToken: string,
    refreshToken: string,
    email: string,
    options?: { onlyIfRefreshToken: string },
  ) => Promise<void>;
  // Same onlyIfRefreshToken guard, for a session ended by its own refusal.
  clear: (options?: { onlyIfRefreshToken: string }) => Promise<void>;
  // Refreshes the current session, de-duplicated across concurrent callers
  // (see the module-level refreshPromise above). Resolves with the new
  // access token. Rejects on any failure, but force-clears the session
  // (spec.md decision #5) only when the server refused the token — a
  // network/server failure keeps the session and schedules a retry.
  refreshSession: () => Promise<string>;
  // Resolves once a renewal in flight (if any) has landed, success or not —
  // so a switch reads the outgoing account's newest refresh token.
  settleRefresh: () => Promise<void>;
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
    // A session stored by a build from before device-bound sessions has no
    // copy under its account yet; without one, switching away and back would
    // find nothing to resume.
    const userId = userIdFromAccessToken(accessToken);
    if (userId && refreshToken && (await accountTokens.get(userId)) === null) {
      await accountTokens.set(userId, refreshToken).catch(() => {});
    }
    // No stored issuedAt (e.g. a session persisted before this feature
    // shipped) is treated as "already due" — the safe default, since we
    // have no better information (S-REF-13).
    const issuedAtMs = issuedAtRaw ? Number(issuedAtRaw) : 0;
    scheduleRefresh(runDueRefresh, remainingDelayMs(issuedAtMs));
  },

  setTokens(accessToken, refreshToken, email, options) {
    return queueCommit(() => commitTokens(accessToken, refreshToken, email, options));
  },

  clear(options) {
    return queueCommit(() => commitClear(options));
  },

  refreshSession() {
    if (refreshPromise) return refreshPromise;

    const { refreshToken, accessToken, email, setTokens, clear } = get();
    if (!refreshToken) {
      return Promise.reject(new Error("no refresh token to refresh with"));
    }
    // The account this renewal is for — still the right one to write to even
    // if the User switches away while it is in flight.
    const userId = userIdFromAccessToken(accessToken);

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
        // Kept under its own account first, switched away or not: that copy
        // is what a later switch back presents, and the server only accepts
        // the newest one (an older one reads as a stolen copy).
        if (userId && (await accountTokens.replace(userId, refreshToken, pair.refresh_token))) {
          emitSessionRenewed(userId, pair.refresh_token);
        }
        // Rejecting (not answering with the new User's token) also stops a
        // request of the previous User from being retried as the new one.
        if (isStale()) throw new Error("session changed during refresh");
        // Checked again at its turn in the commit queue: a switch can still
        // land while this waits, and must win.
        await setTokens(pair.access_token, pair.refresh_token, email ?? "", { onlyIfRefreshToken: refreshToken });
        return pair.access_token;
      })
      .catch(async (err) => {
        // Refused: this account needs signing in again on this device. Only
        // this one — every other saved account keeps its own session.
        const refused = isRefreshRejected(err);
        if (refused && userId) {
          // Unless the account already holds a newer token (a password change
          // or a new sign-in landed meanwhile): then this refusal is about a
          // session that was replaced, not the one in use.
          const dropped = await accountTokens.removeIf(userId, refreshToken).catch(() => false);
          if (dropped || !isStale()) emitSessionRefused(userId);
        }
        if (isStale()) throw err;
        // Offline, timeout or a 5xx says nothing about the refresh token
        // itself — keep the session (the app works from cache and the next
        // request/foreground retries) instead of logging the User out.
        // The renewal stays owed (markRefreshDue) so session-resume.ts
        // renews at once on reconnect / foreground instead of waiting out
        // the retry delay.
        if (!refused) {
          scheduleRefresh(runDueRefresh, REFRESH_RETRY_DELAY_SECONDS * 1000);
          markRefreshDue();
          throw err;
        }
        // Rejects (and skips the toast) when a switch replaced the session
        // while this waited its turn: the new session is not the one refused.
        await clear({ onlyIfRefreshToken: refreshToken });
        // Only this path (the refresh token itself was rejected — expired or
        // revoked) counts as a session actually "ending" out from under the
        // user; an explicit Log out on Settings also calls clear() but
        // already knows why it's happening, so it doesn't need telling.
        useToastStore.getState().show(i18n.t(SESSION_ENDED_MESSAGE), "warning");
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  },

  async settleRefresh() {
    await refreshPromise?.catch(() => {});
  },
}));

// setTokens() / clear() bodies, run through queueCommit (see there).
async function commitTokens(
  accessToken: string,
  refreshToken: string,
  email: string,
  options?: { onlyIfRefreshToken: string },
): Promise<void> {
  const { getState, setState } = useSessionStore;
  if (options && getState().refreshToken !== options.onlyIfRefreshToken) {
    throw new StaleSessionError("session changed before this commit");
  }
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
  const previousUserId = userIdFromAccessToken(getState().accessToken);
  if (previousUserId === null || previousUserId !== userIdFromAccessToken(accessToken)) {
    // Detached first, or the clear would be saved as the previous User's
    // cache. Kept on the device (remove: false) for switching back to them
    // (specs/mobile-offline-support BR-OFF-P05, EC-OFF-09). The outbox is
    // per User and is never touched here.
    await detachQueryPersistence({ remove: false });
    queryClient.clear();
  }
  // Kept under the account too: it is the session this phone resumes when
  // the User switches back to them (lib/account-tokens.ts).
  const userId = userIdFromAccessToken(accessToken);
  if (userId) {
    await accountTokens.set(userId, refreshToken);
    emitSessionRenewed(userId, refreshToken);
  }
  setState({ accessToken, refreshToken, email, role: roleFromAccessToken(accessToken) });

  // Every new pair (login, activate, or a rotation) reschedules the next
  // proactive refresh from scratch — never stacked with a prior pending
  // timer (specs/mobile-session-refresh/spec.md Edge Case #3).
  scheduleRefresh(runDueRefresh);
}

async function commitClear(options?: { onlyIfRefreshToken: string }): Promise<void> {
  if (options && useSessionStore.getState().refreshToken !== options.onlyIfRefreshToken) {
    throw new StaleSessionError("session changed before this sign-out");
  }
  cancelScheduledRefresh();
  await Promise.all([
    secureStorage.removeItem(SECURE_STORE_ACCESS_TOKEN_KEY),
    secureStorage.removeItem(SECURE_STORE_REFRESH_TOKEN_KEY),
    secureStorage.removeItem(SECURE_STORE_EMAIL_KEY),
    secureStorage.removeItem(SECURE_STORE_ISSUED_AT_KEY),
  ]);
  // Sign-out (tapped or forced) removes this User's saved cache (S-OFF-18)
  // but never their outbox (BR-OFF-09).
  await detachQueryPersistence({ remove: true });
  queryClient.clear();
  useSessionStore.setState({ accessToken: null, refreshToken: null, email: null, role: null });
}
