import { walletAccentPalette } from "@/lib/theme";

// Card colours a User can pick for a Wallet (specs/shared-wallets plan F10,
// SRS Feature-03 US-07). The server stores only the KEY; keep the keys in
// step with backend/internal/dto/wallet_request.go's `oneof` list.
//
// Every face was checked against the card's own gradient (WalletCardArt: 22%
// lighter at one corner, 16% darker at the other) with whichever ink
// readableInk() picks for it:
//   - the nine deep colours take white text at ≥ 4.2:1 even on the lightest
//     corner (≥ 4.5:1 on the face itself), and their 80% secondary text stays
//     ≥ 3.3:1;
//   - the three bright ones take dark text at ≥ 7:1, secondary ≥ 5:1.
// A paler or more neutral mid-tone (a plain 600-weight orange, green or teal)
// failed both inks and was left out on purpose. Re-run the check before
// adding a colour here.
export const WALLET_COLORS = [
  { key: "blue", label: "Xanh dương", face: "#1D4ED8" },
  { key: "indigo", label: "Chàm", face: "#4338CA" },
  { key: "violet", label: "Tím", face: "#6D28D9" },
  { key: "magenta", label: "Tím hồng", face: "#A21CAF" },
  { key: "rose", label: "Đỏ hồng", face: "#BE123C" },
  { key: "orange", label: "Cam đất", face: "#9A3412" },
  { key: "green", label: "Xanh lá", face: "#166534" },
  { key: "teal", label: "Xanh két", face: "#115E59" },
  { key: "slate", label: "Xám", face: "#334155" },
  { key: "amber", label: "Vàng", face: "#FBBF24" },
  { key: "lime", label: "Xanh nõn chuối", face: "#A3E635" },
  { key: "cyan", label: "Xanh ngọc", face: "#22D3EE" },
] as const;

export type WalletColorKey = (typeof WALLET_COLORS)[number]["key"];

const FACE_BY_KEY = new Map<string, string>(WALLET_COLORS.map((c) => [c.key, c.face]));

// The position-based colour a wallet gets when its owner has not picked one.
// Colours are assigned by position, not by wallet type, so every card is
// visibly its own. The one wrap-around case that could put the same colour
// on two neighbours — the last wallet landing on the first wallet's slot
// across the loop seam — is nudged to the palette's opposite end.
function automaticAccent(index: number, count: number): string {
  const size = walletAccentPalette.length;
  let slot = index % size;
  if (count > 1 && index === count - 1 && slot === 0) slot = Math.floor(size / 2);
  return walletAccentPalette[slot];
}

/**
 * A wallet's card colour: the one its owner picked, else the automatic one
 * for its position in the list. Shared by Home's carousel, the Wallets
 * screen and the list rows, so a wallet looks the same everywhere.
 */
export function walletFace(color: string | null | undefined, index: number, count: number): string {
  return (color && FACE_BY_KEY.get(color)) || automaticAccent(index, count);
}
