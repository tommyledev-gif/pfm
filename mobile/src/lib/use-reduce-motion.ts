import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS has "reduce motion" turned on.
 *
 * Read from AccessibilityInfo rather than pulled in from Reanimated's
 * useReducedMotion — this project has no Reanimated (DebugBubble's own note
 * records that decision), and a whole native module is not worth one boolean.
 *
 * Callers must treat `true` as "render the final state immediately", not as
 * "animate faster": someone who turns this on is often doing so because motion
 * makes them ill, and a quick version of the same movement is still movement.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
