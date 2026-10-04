import { AppState } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { OUTBOX_FLUSH_MIN_INTERVAL_MS } from "@/lib/constants";
import { userIdFromAccessToken } from "@/lib/jwt";
import { outboxItemsFor, waitForOutboxHydration } from "@/stores/outbox-store";
import { useSessionStore } from "@/stores/session-store";
import { flushOutbox, isFlushing } from "@/features/transactions/outbox/flush-outbox";

let installed = false;
let lastResponseFlushAt = 0;

function hasWaitingItems(): boolean {
  const userId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  return outboxItemsFor(userId).some((i) => i.status === "waiting");
}

// "Server unreachable while the device says online" never produces an
// online event (EC-OFF-02): the first request that succeeds again is the
// signal that the server is back. Throttled — every response passes here.
function onAnyResponse(): void {
  if (isFlushing() || !hasWaitingItems()) return;
  const now = Date.now();
  if (now - lastResponseFlushAt < OUTBOX_FLUSH_MIN_INTERVAL_MS) return;
  lastResponseFlushAt = now;
  void flushOutbox("response");
}

/**
 * Sync triggers (specs/mobile-offline-support US-05 step 1): reconnect,
 * foreground, the outbox finishing its read from storage, and a successful
 * response. The signed-in User appearing (start, login, switch) is triggered
 * from session-scoped-reset's handleSessionUserChange, and Retry/Edit from the
 * UI. Installed once at module scope in app/_layout.tsx.
 */
export function installOutboxSync(): void {
  if (installed) return;
  installed = true;
  onlineManager.subscribe((isOnline) => {
    if (isOnline) void flushOutbox("online");
  });
  AppState.addEventListener("change", (status) => {
    if (status === "active") void flushOutbox("foreground");
  });
  void waitForOutboxHydration().then(() => flushOutbox("hydrated"));
  apiClient.interceptors.response.use((response) => {
    onAnyResponse();
    return response;
  });
}

