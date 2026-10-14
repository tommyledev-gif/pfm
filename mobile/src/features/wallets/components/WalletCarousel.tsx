import { memo } from "react";
import { Animated, Text, View } from "react-native";

import { spacing, typography, walletAccentPalette, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import {
  CARD_HEIGHT,
  CARD_OVERLAP,
  CAROUSEL_SHADOW_BLEED_BOTTOM,
  CAROUSEL_SHADOW_BLEED_TOP,
  WalletStackCard,
} from "@/features/wallets/components/WalletStackCard";
import { SNAP_INTERVAL, useWalletCarousel } from "@/features/wallets/components/use-wallet-carousel";
import { CARD_PERSPECTIVE, useCardMotion } from "@/features/wallets/components/wallet-carousel-motion";
import { WalletCarouselPager } from "@/features/wallets/components/WalletCarouselPager";

// Each wallet's accent by its position in the list. Colors are assigned by
// position, not by wallet type, so every card is visibly its own. The one
// wrap-around case that could put the same color on two neighbours — the last
// wallet landing on the first wallet's slot across the loop seam — is nudged
// to the palette's opposite end.
function accentForIndex(index: number, count: number): string {
  const size = walletAccentPalette.length;
  let slot = index % size;
  if (count > 1 && index === count - 1 && slot === 0) slot = Math.floor(size / 2);
  return walletAccentPalette[slot];
}

interface WalletCarouselProps {
  wallets: Wallet[];
  /** Tapping the CENTRED card. Tapping one at the side brings it to the centre instead. */
  onPressWallet?: (wallet: Wallet) => void;
  /** Wallet to land on when the carousel first lays out; the first one otherwise. */
  initialWalletId?: string | null;
  /** Fires with the centred wallet's id whenever a different card settles in the middle. */
  onActiveWalletChange?: (walletId: string) => void;
  /** Draws a fading "you picked this one" border on this wallet's card. */
  highlightWalletId?: string | null;
  /** The 1 → 0 opacity for that border — from useHighlightFade. */
  highlightOpacity?: Animated.Value;
}

/**
 * The wallets section: the selected wallet centred, its neighbours tucked
 * behind it on both sides and turned away, wrapping around at either end,
 * with a ‹ • ━ • › pager under it. Shared by Home and the Wallets screen's
 * card view, so a wallet keeps the same accent color on both.
 *
 * ⚠️ A plain ScrollView rather than a FlatList, deliberately. Looping means
 * silently jumping the scroll offset by a whole copy's width once the user
 * reaches an edge, and doing that through a virtualised list means fighting
 * its windowing every time. Wallet counts are small enough that rendering
 * every card outright is cheaper than the machinery to avoid it.
 *
 * The OS owns the scroll, so fling physics and the host screen's own vertical
 * scroll both keep working. No reanimated and no gesture-handler — neither is
 * a dependency of this project. Cards and pager dots both run off the one
 * native-driven scroll value.
 */
function WalletCarouselView({
  wallets,
  onPressWallet,
  initialWalletId,
  onActiveWalletChange,
  highlightWalletId,
  highlightOpacity,
}: WalletCarouselProps) {
  const styles = useStyles();
  const {
    scrollRef,
    scrollX,
    containerWidth,
    centreIndex,
    rendered,
    sidePadding,
    onLayout,
    onContentSizeChange,
    onScrollFrame,
    onMomentumEnd,
    pressCard,
    step,
    looping,
    onScrollBeginDrag,
  } = useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange });
  const cardMotion = useCardMotion(rendered.length, scrollX);

  if (wallets.length === 0) {
    return <Text style={styles.empty}>Chưa có ví. Tạo ví để ghi giao dịch.</Text>;
  }

  return (
    <View testID="carousel-wallets" style={styles.container} onLayout={onLayout}>
      <View style={styles.cards}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          disableIntervalMomentum
          decelerationRate="fast"
          // Only the horizontal axis is claimed, so the home screen's vertical
          // scroll still works over the cards.
          directionalLockEnabled
          // No gap: the overlap is carried by each card's negative right margin
          // below, which Yoga will not accept as a negative `gap`.
          contentContainerStyle={{ paddingHorizontal: sidePadding, paddingTop: CAROUSEL_SHADOW_BLEED_TOP, paddingBottom: CAROUSEL_SHADOW_BLEED_BOTTOM }}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          onMomentumScrollEnd={onMomentumEnd}
          onScrollBeginDrag={onScrollBeginDrag}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
            listener: onScrollFrame,
          })}
        >
          {containerWidth === 0
            ? null
            : rendered.map((wallet, index) => {
                const motion = cardMotion[index];
                // Nearest to the centre paints last. The final card keeps its
                // full width so the scrollable content is exactly long enough to
                // bring it to the middle.
                const proximity = Math.abs(index - centreIndex);
                const isLast = index === rendered.length - 1;

                return (
                  <WalletStackCard
                    // Index, not wallet id — the loop copies repeat every id.
                    key={`${wallet.id}-${index}`}
                    wallet={wallet}
                    accentColor={accentForIndex(index % wallets.length, wallets.length)}
                    animatedStyle={{
                      marginRight: isLast ? 0 : -CARD_OVERLAP,
                      // The paint order on iOS, and which card a tap lands on
                      // where two overlap. Android draws by the elevation
                      // below first, which follows the scroll natively, so a
                      // late re-render here no longer shows (see
                      // wallet-carousel-motion).
                      zIndex: rendered.length - proximity,
                      elevation: motion.elevation,
                      transform: [
                        { perspective: CARD_PERSPECTIVE },
                        { translateX: motion.translateX },
                        { rotateY: motion.rotateY },
                        { scale: motion.scale },
                      ],
                      opacity: motion.opacity,
                    }}
                    // Fades the accent border in on whichever card is
                    // centred, without re-rendering on every scroll frame.
                    activeOpacity={motion.active}
                    // A side card is a shortcut for the swipe that would bring it
                    // over; only the card already in the middle is "opened".
                    onPress={() => pressCard(index, onPressWallet ? () => onPressWallet(wallet) : undefined)}
                    // Every loop copy of the wallet gets it — whichever copy is
                    // centred is the one the user sees.
                    highlightOpacity={wallet.id === highlightWalletId ? highlightOpacity : undefined}
                  />
                );
              })}
        </Animated.ScrollView>
      </View>

      <WalletCarouselPager
        dotCount={wallets.length}
        positionCount={rendered.length}
        scrollX={scrollX}
        canGoBack={looping || centreIndex > 0}
        canGoForward={looping || centreIndex < rendered.length - 1}
        onBack={() => step(-1)}
        onForward={() => step(1)}
      />
    </View>
  );
}

// Memoized: Home re-renders for every query it reads, and the carousel is the
// heaviest thing on it — it should re-render only when its own props change.
export const WalletCarousel = memo(WalletCarouselView);

const useStyles = createStyles((colors) => ({
  // Full-bleed: the section's own horizontal padding is cancelled so a
  // neighbour can sit under the screen edge. Pulled back into the surrounding
  // gap above, but never past it — the bleed area is still part of a scroll
  // view and would steal taps meant for the section header.
  container: {
    marginHorizontal: -spacing.xl,
    marginTop: -Math.min(CAROUSEL_SHADOW_BLEED_TOP, spacing.md),
  },
  // A fixed height regardless of wallet count, so content below does not shift
  // as the wallets load. Taller than a card by the shadow bleed, so shadows are
  // not clipped; the pager is pulled up over the bottom bleed (PAGER_OFFSET_TOP).
  cards: { height: CARD_HEIGHT + CAROUSEL_SHADOW_BLEED_TOP + CAROUSEL_SHADOW_BLEED_BOTTOM },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
}));
