import { AppState } from "react-native";
import { create } from "zustand";

import { APP_LOCK_AFTER_BACKGROUND_MS } from "@/lib/constants";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useSessionStore } from "@/stores/session-store";

interface AppLockState {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

/**
 * Whether the signed-in area is behind the app lock right now
 * (specs/mobile-account-switch US-12). Opt-in on the Security screen; when on,
 * the app asks for the phone's owner check (fingerprint, face or screen-lock
 * code) on a cold start with a stored session, and on return from the
 * background after APP_LOCK_AFTER_BACKGROUND_MS.
 *
 * A screen gate only, like the switch check: the stored tokens are not
 * bound to the fingerprint (expo-secure-store can only do that with a prompt
 * on every write, and the session's refresh token is rewritten every ~12
 * minutes — specs/mobile-account-switch, "not adopted").
 */
export const useAppLockStore = create<AppLockState>((set) => ({
  locked: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));

let installed = false;
let backgroundedAt: number | null = null;

function shouldLock(): boolean {
  return useSecurityPrefsStore.getState().appLockEnabled && useSessionStore.getState().accessToken !== null;
}

/**
 * Installed once at module scope in app/_layout.tsx, before the session is
 * hydrated: the cold-start lock is decided once both the session and the
 * security preferences are read, so a session restored from storage opens
 * locked while a fresh sign-in (typed password) does not.
 */
export function installAppLock(): void {
  if (installed) return;
  installed = true;

  let decided = false;
  const decideColdStart = () => {
    if (decided || !useSessionStore.getState().isHydrated || !useSecurityPrefsStore.persist.hasHydrated()) return;
    decided = true;
    if (shouldLock()) useAppLockStore.getState().lock();
  };
  useSessionStore.subscribe(decideColdStart);
  useSecurityPrefsStore.persist.onFinishHydration(decideColdStart);
  decideColdStart();

  // Signed out (logout, a refused session): nothing left to guard.
  useSessionStore.subscribe((state, previous) => {
    if (previous.accessToken !== null && state.accessToken === null) useAppLockStore.getState().unlock();
  });

  AppState.addEventListener("change", (status) => {
    if (status === "background") {
      backgroundedAt = Date.now();
      return;
    }
    if (status !== "active" || backgroundedAt === null) return;
    const away = Date.now() - backgroundedAt;
    backgroundedAt = null;
    if (away >= APP_LOCK_AFTER_BACKGROUND_MS && shouldLock()) useAppLockStore.getState().lock();
  });
}
