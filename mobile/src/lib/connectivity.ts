import { useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";

import { NEEDS_CONNECTION_MESSAGE } from "@/lib/constants";
import { i18n } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";

// Connectivity for the whole app (specs/mobile-offline-support US-02).
// TanStack's onlineManager is the single source of truth — not a Zustand
// store — because TanStack itself already reads it to pause queries offline
// and to refetch them on reconnect; a second store could only drift from it.

// "Connected" alone is not enough: a captive portal or a Wi-Fi with no
// uplink reports connected but unreachable. `null` (not yet probed) counts
// as reachable so a cold start is never shown as offline by mistake.
function isOnlineState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Wires NetInfo into onlineManager and AppState into focusManager. Installed
 * once at module scope in app/_layout.tsx, before the first render. Both
 * setEventListener calls replace (and clean up) any earlier listener, so a
 * fast-refresh re-run never stacks a second subscription.
 */
export function installConnectivity(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
  );
  // React Native has no window focus event; TanStack's refetch-on-focus
  // only works once it is told about the app returning to the foreground.
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (status) => handleFocus(status === "active"));
    return () => subscription.remove();
  });
}

function subscribeOnline(onChange: () => void): () => void {
  return onlineManager.subscribe(onChange);
}

function getIsOnline(): boolean {
  return onlineManager.isOnline();
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getIsOnline);
}

/**
 * Guard for an online-only action (BR-OFF-P04): runs it when online,
 * otherwise shows the "needs a connection" toast and does nothing — so no
 * request is fired and no partial local change is made. Reads connectivity
 * at press time rather than at render time, so a stale render can never
 * let an action through.
 */
export function useRequireOnline(): (action: () => void) => void {
  return useCallback((action: () => void) => {
    if (onlineManager.isOnline()) {
      action();
      return;
    }
    useToastStore.getState().show(i18n.t(NEEDS_CONNECTION_MESSAGE), "warning");
  }, []);
}
