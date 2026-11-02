import { useCallback, useRef } from "react";
import { View } from "react-native";

import { useTooltipStore } from "@/stores/tooltip-store";

// A deliberate hold, but quicker than RevealableAmount's full second: these
// only say what a button does.
export const HINT_DELAY_MS = 500;

/**
 * The target's ref and the call that points a hint bubble at it.
 *
 * ⚠️ Measured through a ref, not the event's currentTarget. Pressability
 * fires onLongPress from a timer, after React has already cleared
 * currentTarget on that event: measure() was called on null, and the
 * uncaught error took the whole app down to a black screen (2026-10-25).
 */
function useShowHint(text: string) {
  const show = useTooltipStore((s) => s.show);
  const ref = useRef<View>(null);
  const showHint = useCallback(() => {
    ref.current?.measure((_x, _y, width, height, pageX, pageY) =>
      show({ x: pageX, y: pageY, width, height }, { kind: "hint", text }),
    );
  }, [show, text]);
  return { ref, showHint };
}

/**
 * A hold on a small icon button shows a few words on what it does
 * (TooltipHost), with no progress bar: spread the result onto the Pressable.
 * The hold takes the press, so the button does not also fire.
 */
export function useHintTooltip(text: string) {
  const { ref, showHint } = useShowHint(text);
  return { ref, onLongPress: showHint, delayLongPress: HINT_DELAY_MS };
}

/**
 * The same bubble on a plain tap, for a target whose only job is to say
 * what it stands for (Home's snapshot rows): a hold there was a gesture
 * nothing on screen announced. Spread the result onto the Pressable.
 */
export function useTapTooltip(text: string) {
  const { ref, showHint } = useShowHint(text);
  return { ref, onPress: showHint };
}
