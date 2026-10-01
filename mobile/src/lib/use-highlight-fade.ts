import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

// Covers the pushed screen's own fade-in (app/(app)/_layout.tsx stacks with
// `animation: "fade"`), so the highlight is seen at full strength before it
// starts to go rather than already half gone on arrival.
const HOLD_MS = 400;
export const HIGHLIGHT_FADE_MS = 2000;

/**
 * A 1 → 0 opacity for a "this is the one you picked" border: shown at full
 * strength, then faded out gradually over HIGHLIGHT_FADE_MS. Replays each
 * time `trigger` changes to a new non-null value (pass a key that includes a
 * nonce, so landing on the same item twice still replays).
 *
 * No reduce-motion branch on purpose: a cross-fade is the replacement that
 * setting asks for in place of movement, not movement itself (see
 * use-reduce-motion.ts for what does count).
 */
export function useHighlightFade(trigger: string | null): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trigger) return;
    opacity.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: HIGHLIGHT_FADE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [trigger, opacity]);

  return opacity;
}
