import { memo, useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { mixHex } from "@/lib/color";
import { walletCardInk } from "@/lib/theme";

interface WalletCardArtProps {
  accentColor: string;
  width: number;
  height: number;
}

// Highlights on the card face are white at these strengths whatever the ink:
// they are light falling on the card, not text.
const GLOW_OPACITY = 0.38;
const RING_OPACITY = 0.2;
const WAVE_OPACITY = 0.1;

/**
 * A wallet card's face, painted the way a bank card is: the accent at full
 * strength, lifted toward white in the top-left and deepened toward the
 * bottom-right, a soft glow in the top-right corner with two rings around it,
 * and a low wave across the bottom.
 *
 * Static per wallet colour, so it is memoized: the carousel moves cards by
 * transform only, and an SVG re-render per frame would cost more than all the
 * motion together.
 */
function WalletCardArtView({ accentColor, width, height }: WalletCardArtProps) {
  // SVG ids must be unique on screen — the loop copies render the same wallet
  // several times. useId's colons are not valid in url(#…).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const baseId = `wallet-base-${uid}`;
  const glowId = `wallet-glow-${uid}`;
  const light = walletCardInk.light;

  const wave =
    `M 0 ${height * 0.8} ` +
    `C ${width * 0.3} ${height * 0.6}, ${width * 0.62} ${height * 1.04}, ${width} ${height * 0.68} ` +
    `L ${width} ${height} L 0 ${height} Z`;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {/* Top-left (0,0) to bottom-right (1,1). */}
        <LinearGradient id={baseId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={mixHex(accentColor, light, 0.22)} />
          <Stop offset="0.5" stopColor={accentColor} />
          <Stop offset="1" stopColor={mixHex(accentColor, "#000000", 0.16)} />
        </LinearGradient>
        <RadialGradient id={glowId} cx={width * 0.9} cy={height * 0.04} r={width * 0.55} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={light} stopOpacity={GLOW_OPACITY} />
          <Stop offset="1" stopColor={light} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${baseId})`} />
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${glowId})`} />
      <Circle cx={width - 6} cy={-4} r={46} stroke={light} strokeOpacity={RING_OPACITY} strokeWidth={1.2} fill="none" />
      <Circle cx={width - 6} cy={-4} r={74} stroke={light} strokeOpacity={RING_OPACITY * 0.6} strokeWidth={1.2} fill="none" />
      <Path d={wave} fill={light} fillOpacity={WAVE_OPACITY} />
    </Svg>
  );
}

export const WalletCardArt = memo(WalletCardArtView);
