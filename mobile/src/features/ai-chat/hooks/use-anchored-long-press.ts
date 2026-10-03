import { useRef } from "react";
import { View } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";

/**
 * A long-press handler that reports the pressed element's own frame, so a
 * popover can open right next to it. Attach `ref` to the Pressable.
 */
export function useAnchoredLongPress(onLongPress?: (anchor: PopoverAnchor) => void) {
  const ref = useRef<View>(null);
  const handleLongPress = onLongPress
    ? () => ref.current?.measureInWindow((x, y, width, height) => onLongPress({ x, y, width, height }))
    : undefined;
  return { ref, handleLongPress };
}
