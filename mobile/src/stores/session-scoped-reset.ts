import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { userIdFromAccessToken } from "@/lib/jwt";
import { flushOutbox } from "@/features/transactions/outbox/flush-outbox";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";

interface PersistedStore {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}

// A persisted store still being read back from AsyncStorage would overwrite
// whatever is done to it the moment it finishes — so wait for it first.
function afterHydration(store: PersistedStore, fn: () => void): void {
  if (store.persist.hasHydrated()) {
    fn();
    return;
  }
  const unsubscribe = store.persist.onFinishHydration(() => {
    unsubscribe();
    fn();
  });
}

interface SessionUserChange {
  /** null = nobody was signed in. */
  previousUserId: string | null;
  /** null = the session just ended. */
  nextUserId: string | null;
  /** The session was restored from storage on launch, not freshly entered. */
  isRestore: boolean;
}

/**
 * THE place where "the signed-in User changed" resets per-User local state —
 * logout, session expiry, login, add-account and account switch A → B
 * (specs/mobile-account-switch AC-09) all arrive here. Extend this function
 * (e.g. per-User query persistence / outbox from specs/mobile-offline-support)
 * rather than adding a second listener. The query cache itself is cleared by
 * session-store.setTokens()/clear() before the new session becomes visible,
 * and commit-session.ts cancels in-flight queries before that.
 *
 * - Chat thread: wiped when a session ends and whenever a different User
 *   enters. Nothing is lost — the server holds the thread and the chat screen
 *   restores it. Left alone, the next User inherited it, and chat-store's
 *   sync then uploaded it to *their* account.
 * - Saved budget plan: local only and kept per User (never wiped on logout —
 *   a refresh token expiring after a week away must not cost the User their
 *   plan); the store is simply pointed at the new User.
 * - Saved query cache (specs/mobile-offline-support BR-OFF-P05): detached by
 *   session-store itself, because that must happen BEFORE the cache clear
 *   that precedes this call; UserScopedQueryPersistence re-attaches it for
 *   the next User. Switch keeps the previous User's copy, logout removes it.
 * - Outbox: per User and NEVER cleared here — not on logout, forced logout,
 *   revoke-all or switch (BR-OFF-09). The incoming User's own queue is synced
 *   (US-05 step 1); the flusher's owner guard keeps everyone else's untouched.
 */
export function handleSessionUserChange({ nextUserId, isRestore }: SessionUserChange): void {
  if (nextUserId === null) {
    useChatStore.getState().clear(null);
    return;
  }
  // A restored session keeps the thread on disk only if it is this User's
  // (chat-store records its owner); a session entered just now always starts
  // empty and owned by them, and the chat screen restores their server copy.
  afterHydration(useChatStore, () => {
    if (isRestore) useChatStore.getState().claimFor(nextUserId);
    else useChatStore.getState().clear(nextUserId);
  });
  afterHydration(useSavedBudgetPlanStore, () => useSavedBudgetPlanStore.getState().claimFor(nextUserId, isRestore));
  void flushOutbox("session");
}

/**
 * Keeps one User's locally persisted data away from the next User on the same
 * device. AsyncStorage is per device, not per account, and a session can end
 * or change on paths that never pass through Settings — axios.ts's 401
 * handler, a failed refresh, an account switch. Hooking the session itself
 * covers every one of them, including any added later.
 *
 * Installed once at module scope in app/_layout.tsx, before session-store's
 * hydrate() can run.
 */
export function installSessionScopedReset(): void {
  useSessionStore.subscribe((state, prev) => {
    const previousUserId = userIdFromAccessToken(prev.accessToken);
    const nextUserId = userIdFromAccessToken(state.accessToken);
    // Same User (token rotation, sign-out-everywhere's fresh pair) or no
    // change at all — nothing per-User to reset.
    if (previousUserId === nextUserId) return;
    // hydrate() flips isHydrated in the same update that restores the token,
    // so a session that was already hydrated beforehand was entered just now.
    handleSessionUserChange({ previousUserId, nextUserId, isRestore: !prev.isHydrated });
  });
}
