import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

import { OFFLINE_STRIP_SHOW_DELAY_MS, ONLINE_STABLE_DELAY_MS, RECONNECTED_STRIP_MS } from "@/lib/constants";

/**
 * What the offline strip under the status bar shows:
 *   hidden      — nothing; the strip is collapsed to zero height
 *   offline     — "Ngoại tuyến"
 *   reconnected — "Đã kết nối lại · đang đồng bộ", briefly, then hidden
 */
export type ConnectionStripState = "hidden" | "offline" | "reconnected";

// ⚠️ One state for the whole app, not one per strip. Every mounted screen
// renders its own strip (Screen.tsx), and tabs stay mounted behind each
// other — per-strip timers would let a screen opened while offline sit
// strip-less for the show delay and then shove its content down, on every
// navigation. Shared, a newly mounted screen starts exactly where the others are.
let state: ConnectionStripState = "hidden";
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;
const listeners = new Set<() => void>();

function setState(next: ConnectionStripState) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function after(ms: number, run: () => void) {
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    run();
  }, ms);
}

// onlineManager only notifies on an actual change, so calls alternate
// offline / online.
function onConnectivityChange(online: boolean) {
  if (!online) {
    // Already up (offline, or mid-"reconnected"): go straight back to
    // offline — the strip is visible, so nothing moves. Hidden: wait out
    // the show delay, so a blip never makes it appear at all.
    if (state === "hidden") after(OFFLINE_STRIP_SHOW_DELAY_MS, () => setState("offline"));
    else {
      clearTimer();
      setState("offline");
    }
    return;
  }
  if (state === "offline") {
    after(ONLINE_STABLE_DELAY_MS, () => {
      setState("reconnected");
      after(RECONNECTED_STRIP_MS, () => setState("hidden"));
    });
  } else if (state === "hidden") {
    // A drop shorter than the show delay — it never showed, so drop it.
    clearTimer();
  }
}

function subscribe(listener: () => void): () => void {
  if (!installed) {
    installed = true;
    // Kept for the app's lifetime: unsubscribing with the last strip would
    // lose transitions that happen while no screen is mounted.
    onlineManager.subscribe(onConnectivityChange);
    // Offline before any screen mounted (an app opened without a network):
    // that is the starting condition, not a flap — show it at once.
    if (!onlineManager.isOnline()) setState("offline");
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ConnectionStripState {
  return state;
}

export function useConnectionStrip(): ConnectionStripState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
