// Per-card surface for the home stack.
//
// The cards overlap now, so "one surface colour for all of them" left the pile
// reading as a single folded sheet — the eye needs a change of colour at each
// seam to count the cards. What it must NOT become is a fruit salad: these are
// all the same kind of object, so every entry stays inside the app's own
// green/teal family and differs only in hue and warmth. Anything further out
// (the lavender/mustard used for wallet TYPE) would start claiming a meaning
// the colour does not carry — type is already said by the icon tile and the
// dot beside the name.
export interface WalletSurface {
  /** Card fill. Opaque: neighbouring cards pass underneath it. */
  bg: string;
  /** Full-strength accent — the resting border, the active tint and border. */
  accent: string;
}

const WALLET_SURFACES: WalletSurface[] = [
  { bg: "#0E1A11", accent: "#85FF33" },
  { bg: "#0B1A18", accent: "#7EEBC0" },
  { bg: "#131C0C", accent: "#CDF538" },
  { bg: "#091D19", accent: "#66F0CE" },
  { bg: "#0D1B14", accent: "#8FF0AB" },
  { bg: "#101E12", accent: "#88F066" },
];

// Same algorithm as lib/category-color's own hash, kept local rather than
// shared: that one is about categories and is free to change its palette or
// its probing without dragging wallet colours along with it. What both need to
// hold is only that a given id always lands on the same slot.
function hashOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable per wallet: the same wallet is the same colour every session. */
export function walletSurface(walletId: string): WalletSurface {
  return WALLET_SURFACES[hashOf(walletId) % WALLET_SURFACES.length];
}
