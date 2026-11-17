import { BALL_TOP, BOB_DISTANCE, PILL_HEIGHT } from "@/components/shared/bottom-nav-styles";
import { radii, spacing } from "@/lib/theme";

// BottomNav sits flush at the safe-area inset and floats its active-tab ball
// above its top edge (by -BALL_TOP, plus the idle bob at its peak) — this is
// how far above the screen's bottom edge (plus the safe-area inset) the input
// bar rests to clear the ball, with a small gap, while the keyboard is closed.
// Derived rather than hardcoded: the old fixed 104 predated BALL_SINK seating
// the ball lower, and left the bar floating 20px above it.
export const COMPOSER_NAV_CLEARANCE = PILL_HEIGHT - BALL_TOP + BOB_DISTANCE + spacing.sm;
// Small gap between the input bar and the top of an open keyboard.
export const COMPOSER_KEYBOARD_GAP = spacing.sm;

// The location switch is a tab on the input bar's top edge (ChatInputBar's
// `tab`): part of the bar's own container, not a button floating over the
// thread. It sits clear of the bar's rounded corner, on the straight part of
// the edge, so its right side is the corner's radius in from the bar's.
export const LOCATION_TAB_BUTTON = 32;
export const LOCATION_TAB_PADDING_X = spacing.sm;
export const LOCATION_TAB_WIDTH = LOCATION_TAB_BUTTON + LOCATION_TAB_PADDING_X * 2;
export const LOCATION_TAB_HEIGHT = LOCATION_TAB_BUTTON + spacing.xs;
export const LOCATION_TAB_INSET_RIGHT = spacing.xl + radii.hero;
