import { AppState } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { isRefreshDue } from "@/lib/refresh-scheduler";
import { useSessionStore } from "@/stores/session-store";

// Pays a session renewal that came due while the app could not send it —
// offline, or backgrounded (JS timers do not run there). Triggered by the
// device coming back online and by the app returning to the foreground
// (specs/mobile-offline-support AC-OFF-02, BR-OFF-P01). refreshSession() is
// already de-duplicated, so overlapping triggers send one request.
function resumeIfDue(): void {
  const { refreshToken, isHydrated, refreshSession } = useSessionStore.getState();
  if (!isHydrated || !refreshToken) return;
  if (!onlineManager.isOnline() || !isRefreshDue()) return;
  refreshSession().catch(() => {});
}

let installed = false;

/** Installed once at module scope in app/_layout.tsx. */
export function installSessionResume(): void {
  if (installed) return;
  installed = true;
  onlineManager.subscribe((isOnline) => {
    if (isOnline) resumeIfDue();
  });
  AppState.addEventListener("change", (status) => {
    if (status === "active") resumeIfDue();
  });
}
