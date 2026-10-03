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

// How far a neighbour leans further inward on top of the overlap, so the
// flanking cards tuck under the active one instead of merely touching it.
const NEIGHBOUR_OVERLAP = 18;
const NEIGHBOUR_SCALE = 0.88;
const NEIGHBOUR_OPACITY = 0.5;

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
 * The wallets section: the selected wallet centred, its neighbours peeking on
 * both sides, wrapping around at either end. Shared by Home and the Wallets
 * screen's card view, so a wallet keeps the same accent color on both.
 *
 * ⚠️ A plain ScrollView rather than a FlatList, deliberately. Looping means
 * silently jumping the scroll offset by a whole copy's width once the user
 * reaches an edge, and doing that through a virtualised list means fighting
 * its windowing every time. Wallet counts are small enough that rendering
 * every card outright is cheaper than the machinery to avoid it.
 *
 * The OS owns the scroll, so fling physics and the host screen's own vertical
 * scroll both keep working. No reanimated and no gesture-handler — neither is
 * a dependency of this project.
 */
export function WalletCarousel({
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
    onScrollBeginDrag,
  } = useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange });

  if (wallets.length === 0) {
    return <Text style={styles.empty}>Chưa có ví nào — thêm một ví để bắt đầu.</Text>;
  }

  return (
    <View testID="carousel-wallets" style={styles.container} onLayout={onLayout}>
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
              // Where this card sits relative to the viewport's centre, in
              // snap intervals: -1 is one card left of centre, 0 is centred.
              const offsetFromCentre = Animated.subtract(index, Animated.divide(scrollX, SNAP_INTERVAL));
              const range = [-1, 0, 1];
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
                    zIndex: rendered.length - proximity,
                    // Android orders siblings by elevation before zIndex, so
                    // the two have to agree or the stack inverts there. Kept in
                    // a small range because on Android elevation is also the
                    // shadow's size — ordering by raw index would give the
                    // centre card a shadow the size of the card.
                    elevation: Math.max(0, 8 - proximity),
                    transform: [
                      {
                        translateX: offsetFromCentre.interpolate({
                          inputRange: range,
                          outputRange: [NEIGHBOUR_OVERLAP, 0, -NEIGHBOUR_OVERLAP],
                          extrapolate: "clamp",
                        }),
                      },
                      {
                        scale: offsetFromCentre.interpolate({
                          inputRange: range,
                          outputRange: [NEIGHBOUR_SCALE, 1, NEIGHBOUR_SCALE],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                    opacity: offsetFromCentre.interpolate({
                      inputRange: range,
                      outputRange: [NEIGHBOUR_OPACITY, 1, NEIGHBOUR_OPACITY],
                      extrapolate: "clamp",
                    }),
                  }}
                  // Fades the accent border in on whichever card is
                  // centred, without re-rendering on every scroll frame.
                  activeOpacity={offsetFromCentre.interpolate({
                    inputRange: [-0.6, 0, 0.6],
                    outputRange: [0, 1, 0],
                    extrapolate: "clamp",
                  })}
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
  );
}

const useStyles = createStyles((colors) => ({
  // A fixed height regardless of wallet count, so content below does not shift
  // as the wallets load. Full-bleed: the section's own horizontal padding is
  // cancelled so a neighbour can sit under the screen edge. Taller than a card
  // by the shadow bleed, so shadows are not clipped.
  container: {
    height: CARD_HEIGHT + CAROUSEL_SHADOW_BLEED_TOP + CAROUSEL_SHADOW_BLEED_BOTTOM,
    marginHorizontal: -spacing.xl,
    // Pulled back into the surrounding gap, but never past it — the bleed
    // area is still part of a scroll view and would steal taps meant for the
    // section header or the next section.
    marginTop: -Math.min(CAROUSEL_SHADOW_BLEED_TOP, spacing.md),
    marginBottom: -Math.min(CAROUSEL_SHADOW_BLEED_BOTTOM, spacing.md),
  },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
}));
