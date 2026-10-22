import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

// One native query and one listener for the whole app, however many
// components ask: a screen of skeletons used to make one each.
let reduceMotion = false;
let installed = false;
const listeners = new Set<() => void>();

function update(next: boolean) {
  if (next === reduceMotion) return;
  reduceMotion = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (!installed) {
    installed = true;
    AccessibilityInfo.isReduceMotionEnabled().then(update);
    AccessibilityInfo.addEventListener("reduceMotionChanged", update);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether the OS has "reduce motion" turned on.
 *
 * Callers must treat `true` as "render the final state immediately", not as
 * "animate faster": a quick version of the same movement is still movement.
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduceMotion);
}
