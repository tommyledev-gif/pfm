import { ComponentType, createContext, useContext } from "react";

import { spacing } from "@/lib/theme";

// The measurements every inset-grouped list shares (iOS Settings' "inset
// grouped" style): one rounded container per group, rows inside it split by
// hairlines that start where the text starts, not at the container's edge.
export const LIST_ROW_PADDING_X = spacing.lg;
export const LIST_ROW_PADDING_Y = spacing.md;
export const LIST_ROW_GAP = spacing.md;
export const LIST_ROW_MIN_HEIGHT = 52;
export const LIST_ICON_TILE_SIZE = 30;
export const LIST_ICON_GLYPH_SIZE = 18;
export const LIST_ICON_TILE_RADIUS = 8;
/** How strongly a tile is tinted with its tone. */
export const LIST_ICON_TINT_ALPHA = 0.16;
/** A pressed row's wash, through withAlpha(colors.overlayBase, …). */
export const LIST_PRESSED_ALPHA = 0.06;
export const LIST_SEPARATOR_ALPHA = 0.1;
export const LIST_DISABLED_OPACITY = 0.4;

/** Phosphor glyphs and the app's own Icon.tsx set both fit. */
export type ListGlyph = ComponentType<{ size?: number; color?: string; weight?: "regular" | "bold" | "fill" }>;

/** Where a row's text starts: the separator above it starts there too. */
export function textInset(leadingWidth?: number): number {
  return leadingWidth ? LIST_ROW_PADDING_X + leadingWidth + LIST_ROW_GAP : LIST_ROW_PADDING_X;
}

/**
 * A row's position in its group, set by ListSection (or GroupedListCell in a
 * virtualised list). Rows read it to know whether a hairline goes above
 * them; outside a group it is null and no row draws one.
 */
export const ListPositionContext = createContext<number | null>(null);

/** True when the row reading it is not the first in its group. */
export function useHasRowAbove(): boolean {
  const index = useContext(ListPositionContext);
  return index !== null && index > 0;
}
