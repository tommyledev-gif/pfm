import { memo, useMemo } from "react";
import { Animated as RNAnimated } from "react-native";
import { SharedValue } from "react-native-reanimated";

import { Wallet } from "@/features/wallets/types";
import { CAROUSEL_SHADOW_BLEED_TOP, WalletStackCard } from "@/features/wallets/components/WalletStackCard";
import { useCardMotion } from "@/features/wallets/components/wallet-carousel-motion";

export interface CarouselCardProps {
  wallet: Wallet;
  index: number;
  accentColor: string;
  left: number;
  scrollX: SharedValue<number>;
  centre: SharedValue<number>;
  intro: SharedValue<number>;
  pressTarget: SharedValue<number>;
  pressDepth: SharedValue<number>;
  highlightOpacity?: RNAnimated.Value;
  /** Wallets in the loop when the deck is one card per wallet; 0 when it draws every copy. */
  loopCount: number;
}

// One card, so each gets its own motion hooks (hooks cannot run in a loop).
// Memoized: a swipe changes the centred index, which must not re-render every card.
export const CarouselCard = memo(function CarouselCard({
  wallet,
  index,
  accentColor,
  left,
  scrollX,
  centre,
  intro,
  pressTarget,
  pressDepth,
  highlightOpacity,
  loopCount,
}: CarouselCardProps) {
  const motion = useCardMotion(index, scrollX, centre, intro, pressTarget, pressDepth, loopCount);
  const layoutStyle = useMemo(() => ({ position: "absolute" as const, left, top: CAROUSEL_SHADOW_BLEED_TOP }), [left]);
  return (
    <WalletStackCard
      wallet={wallet}
      accentColor={accentColor}
      motion={motion}
      layoutStyle={layoutStyle}
      highlightOpacity={highlightOpacity}
    />
  );
});
