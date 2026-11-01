// Wallet card and carousel geometry. Plain numbers with no imports, so every
// carousel module (the card, its sheen, the motion, the scroll hook) can read
// them without an import cycle between those modules.

export const CARD_WIDTH = 236;
export const CARD_HEIGHT = 132;
// How far each card sits UNDER the one before it, as a negative margin rather
// than a gap. The cards used to be laid out with 12px of background between
// them, which read as a filmstrip of unrelated tiles; overlapping them makes
// the row read as one stack of cards with the active one lifted off the top.
export const CARD_OVERLAP = 56;
// Each card steps less than its own width, so every card overlaps its
// neighbour — the layout itself is a stack, not a row with gaps.
export const SNAP_INTERVAL = CARD_WIDTH - CARD_OVERLAP;
// Vertical room the card's drop shadow needs beyond the card (radius 14,
// pushed 6 down, so more below than above). The carousel's scroll box clips
// anything outside its bounds, so it reserves this much on each side. The
// bottom was 22, which cut off the tail of Android's elevation shadow: its
// light sits above the screen, so a card's shadow falls further down the
// lower the card is. The pager is pulled up by the same amount
// (PAGER_OFFSET_TOP), so nothing below the cards moves.
export const CAROUSEL_SHADOW_BLEED_TOP = 10;
export const CAROUSEL_SHADOW_BLEED_BOTTOM = 32;

// The streak of light that crosses a card as it turns (WalletCardSheen). Twice
// the card's height and centred on it, so it still spans the whole face once
// it is rotated.
export const SHEEN_WIDTH = 64;
export const SHEEN_HEIGHT = CARD_HEIGHT * 2;
export const SHEEN_TOP = -(SHEEN_HEIGHT - CARD_HEIGHT) / 2;
export const SHEEN_ANGLE = "18deg";
// Where the streak's box sits when its card is a full step to the left /
// right of centre: off the face entirely (rotation included) on both ends, so
// it crosses the whole card over one swipe.
export const SHEEN_X_FROM_LEFT = CARD_WIDTH + 24;
export const SHEEN_X_FROM_RIGHT = -90;
