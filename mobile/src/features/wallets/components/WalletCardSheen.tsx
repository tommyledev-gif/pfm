import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { walletCardInk } from "@/lib/theme";
import type { CardMotion } from "@/features/wallets/components/wallet-carousel-motion";
import { SHEEN_HEIGHT, SHEEN_TOP, SHEEN_WIDTH } from "@/features/wallets/components/wallet-card-geometry";

const SHEEN_PEAK_OPACITY = 0.3;

/**
 * The streak of light across a wallet card. It slides with the card's turn
 * (wallet-carousel-motion's `sheen`) and shows only while the card is moving,
 * so a card swiping into the middle catches the light the way a real card
 * tilted under a lamp does, and a card at rest carries no stripe. One per
 * card, inside the card's clip, so it never paints past the rounded corners.
 */
export function WalletCardSheen({ motion, id }: { motion: CardMotion; id: string }) {
  const light = walletCardInk.light;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, motion.sheen]}>
      <Svg width={SHEEN_WIDTH} height={SHEEN_HEIGHT}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={light} stopOpacity={0} />
            <Stop offset="0.5" stopColor={light} stopOpacity={SHEEN_PEAK_OPACITY} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={SHEEN_WIDTH} height={SHEEN_HEIGHT} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheen: { position: "absolute", left: 0, top: SHEEN_TOP, width: SHEEN_WIDTH, height: SHEEN_HEIGHT },
});
