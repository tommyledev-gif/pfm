import { ACCESS_TOKEN_TTL_SECONDS, PROACTIVE_REFRESH_LEAD_SECONDS } from "@/lib/constants";

// Proactive refresh timer (specs/mobile-session-refresh/spec.md US-02) — a
// single module-level handle, never stacked: every scheduleRefresh() call
// cancels whatever was pending first (Edge Case #3). Plain setTimeout is
// enough here; there is no cross-screen/cross-render state to coordinate,
// which is why this isn't a Zustand store.
let timer: ReturnType<typeof setTimeout> | null = null;

const LEAD_TIME_MS = (ACCESS_TOKEN_TTL_SECONDS - PROACTIVE_REFRESH_LEAD_SECONDS) * 1000;

// delayMs defaults to a full lead-time window (a fresh token was just
// issued); callers pass an explicit shorter delay after hydration, when part
// of the window may have already elapsed while the app was closed
// (S-REF-13).
export function scheduleRefresh(onDue: () => void, delayMs: number = LEAD_TIME_MS): void {
  cancelScheduledRefresh();
  timer = setTimeout(onDue, Math.max(delayMs, 0));
}

export function cancelScheduledRefresh(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

// Remaining time until a token pair issued at `issuedAtMs` enters its
// proactive-refresh window — zero (not negative) once already due, which
// scheduleRefresh's setTimeout treats as "fire on the next tick".
export function remainingDelayMs(issuedAtMs: number): number {
  return Math.max(issuedAtMs + LEAD_TIME_MS - Date.now(), 0);
}
