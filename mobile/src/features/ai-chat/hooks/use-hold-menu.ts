import { useState } from "react";
import { Keyboard, Vibration } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";
import { HOLD_VIBRATION_MS } from "@/lib/gestures";

/**
 * Open/close state for a long-press popover, plus where it is anchored.
 * Opening closes the keyboard first: the menu is what the User reached for,
 * and a keyboard left open under it hides half of it (spec US-05).
 */
export function useHoldMenu() {
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

  const open = (next: PopoverAnchor) => {
    Keyboard.dismiss();
    Vibration.vibrate(HOLD_VIBRATION_MS);
    setAnchor(next);
  };

  return { visible: anchor !== null, anchor, open, close: () => setAnchor(null) };
}
