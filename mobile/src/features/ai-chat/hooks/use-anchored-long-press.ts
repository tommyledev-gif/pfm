import { useRef } from "react";
import { View } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";

/**
 * A long-press handler that reports the pressed element's own frame, so a
 * popover can open right next to it. Attach `ref` to the Pressable. Page
 * coordinates (measure), not window ones: see PopoverAnchor.
 */
export function useAnchoredLongPress(onLongPress?: (anchor: PopoverAnchor) => void) {
  const ref = useRef<View>(null);
  const handleLongPress = onLongPress
    ? () =>
        ref.current?.measure((_x, _y, width, height, pageX, pageY) => onLongPress({ x: pageX, y: pageY, width, height }))
    : undefined;
  return { ref, handleLongPress };
}
