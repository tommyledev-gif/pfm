import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { decodeAccessTokenClaims } from "@/lib/jwt";
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

/**
 * Keeps one User's locally persisted data away from the next User on the same
 * device. AsyncStorage is per device, not per account, and a session can end
 * on paths that never pass through Settings' logout — axios.ts's 401 handler
 * and a failed refresh both call session-store's clear() directly. Hooking
 * the session itself covers every one of them, including any added later.
 *
 * - Chat thread: wiped when a session ends and when a new one is logged into.
 *   Nothing is lost — the server holds the thread and the chat screen
 *   restores it. Left alone, the next User inherited it, and chat-store's
 *   sync then uploaded it to *their* account.
 * - Saved budget plan: local only, so it is never wiped on logout (a refresh
 *   token expiring after a week away must not cost the User their plan) —
 *   it is owned instead, and dropped only when someone else logs in.
 *
 * Installed once at module scope in app/_layout.tsx, before session-store's
 * hydrate() can run.
 */
export function installSessionScopedReset(): void {
  useSessionStore.subscribe((state, prev) => {
    if (prev.accessToken !== null && state.accessToken === null) {
      useChatStore.getState().clear();
      return;
    }

    const userId = decodeAccessTokenClaims(state.accessToken)?.user_id;
    if (prev.accessToken !== null || state.accessToken === null || !userId) return;

    // hydrate() flips isHydrated in the same update that restores the token,
    // so a session that was already hydrated beforehand is a fresh login.
    const isLogin = prev.isHydrated;
    if (isLogin) afterHydration(useChatStore, () => useChatStore.getState().clear());
    afterHydration(useSavedBudgetPlanStore, () => useSavedBudgetPlanStore.getState().claimFor(userId, !isLogin));
  });
}
