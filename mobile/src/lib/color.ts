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
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/**
 * `from` moved `amount` (0–1) of the way toward `to`, as `#RRGGBB` — a tint
 * toward white or a shade toward black without a translucent layer. Returns
 * `from` unchanged if either colour is not a six-digit hex.
 */
export function mixHex(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * Whichever of `dark` / `light` reads better as text on `background`, by WCAG
 * contrast ratio — for text drawn on a colour picked at runtime rather than
 * on a theme surface.
 */
export function readableInk(background: string, dark: string, light: string): string {
  const bg = relativeLuminance(background);
  const ratio = (ink: string) => {
    const l = relativeLuminance(ink);
    return (Math.max(bg, l) + 0.05) / (Math.min(bg, l) + 0.05);
  };
  return ratio(dark) >= ratio(light) ? dark : light;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHex(hex: string): [number, number, number] | null {
  const match = HEX_6.exec(hex);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((pair) => parseInt(pair, 16));
  return [r, g, b];
}
