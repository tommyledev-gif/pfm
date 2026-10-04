import { spacing } from "@/lib/theme";

// BottomNav sits flush at the safe-area inset, stands 64 tall, and floats its
// active-tab ball another 24 above that — this is how far above the screen's
// bottom edge (plus the safe-area inset) the input bar rests to clear the
// ball while the keyboard is closed.
export const COMPOSER_NAV_CLEARANCE = 104;
// Small gap between the input bar and the top of an open keyboard.
export const COMPOSER_KEYBOARD_GAP = spacing.sm;
