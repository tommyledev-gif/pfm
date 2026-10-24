import { useCallback } from "react";
import { GestureResponderEvent, View } from "react-native";

import { useTooltipStore } from "@/stores/tooltip-store";

// A deliberate hold, but quicker than RevealableAmount's full second: these
// only say what a button does.
export const HINT_DELAY_MS = 500;

/**
 * A hold on a small icon button shows a few words on what it does
 * (TooltipHost), with no progress bar: spread the result onto the Pressable.
 * The hold takes the press, so the button does not also fire.
 */
export function useHintTooltip(text: string) {
  const show = useTooltipStore((s) => s.show);
  const onLongPress = useCallback(
    (event: GestureResponderEvent) => {
      // The pressed host view itself, so no ref has to be threaded through.
      const target = event.currentTarget as unknown as Pick<View, "measure">;
      target.measure((_x, _y, width, height, pageX, pageY) => show({ x: pageX, y: pageY, width, height }, { kind: "hint", text }));
    },
    [show, text],
  );
  return { onLongPress, delayLongPress: HINT_DELAY_MS };
}
