const HEX_6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * `#RRGGBB` at the given opacity, as `rgba()`.
 *
 * Use this instead of gluing a two-digit alpha onto a token (`${colors.green}1A`):
 * that only works while the token is a six-digit hex, and turns into an
 * invalid colour without any error the day a token is written another way.
 * A colour this cannot parse is returned unchanged, so the worst case is the
 * colour at full opacity, never a missing one.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = HEX_6.exec(hex);
  if (!match) return hex;
  const [r, g, b] = match.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
