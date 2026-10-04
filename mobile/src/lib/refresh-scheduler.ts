import { ACCESS_TOKEN_TTL_SECONDS, PROACTIVE_REFRESH_LEAD_SECONDS } from "@/lib/constants";

// Proactive refresh timer (specs/mobile-session-refresh/spec.md US-02) — a
// single module-level handle, never stacked: every scheduleRefresh() call
// cancels whatever was pending first (Edge Case #3). Plain setTimeout is
// enough here; there is no cross-screen/cross-render state to coordinate,
// which is why this isn't a Zustand store.
let timer: ReturnType<typeof setTimeout> | null = null;
// Wall-clock time the pending refresh is due at. Tracked separately from the
// timer because JS timers do not run while the app is backgrounded, and a
// timer that fired while offline was skipped on purpose — either way the
// renewal is still owed, and session-resume.ts reads isRefreshDue() on
// reconnect / foreground to pay it (specs/mobile-offline-support BR-OFF-P01).
let dueAtMs: number | null = null;

const LEAD_TIME_MS = (ACCESS_TOKEN_TTL_SECONDS - PROACTIVE_REFRESH_LEAD_SECONDS) * 1000;

// delayMs defaults to a full lead-time window (a fresh token was just
// issued); callers pass an explicit shorter delay after hydration, when part
// of the window may have already elapsed while the app was closed
// (S-REF-13).
export function scheduleRefresh(onDue: () => void, delayMs: number = LEAD_TIME_MS): void {
  cancelScheduledRefresh();
  const safeDelayMs = Math.max(delayMs, 0);
  dueAtMs = Date.now() + safeDelayMs;
  timer = setTimeout(onDue, safeDelayMs);
}

export function cancelScheduledRefresh(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  dueAtMs = null;
}

// A failed renewal is owed right away, even though its retry timer is set a
// little later — so a reconnect or a return to the foreground renews at once
// instead of waiting out the retry delay (AC-OFF-02). Keeps the timer.
export function markRefreshDue(): void {
  dueAtMs = Date.now();
}

export function isRefreshDue(): boolean {
  return dueAtMs !== null && Date.now() >= dueAtMs;
}

// Remaining time until a token pair issued at `issuedAtMs` enters its
// proactive-refresh window — zero (not negative) once already due, which
// scheduleRefresh's setTimeout treats as "fire on the next tick".
export function remainingDelayMs(issuedAtMs: number): number {
  return Math.max(issuedAtMs + LEAD_TIME_MS - Date.now(), 0);
}
