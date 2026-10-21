import { memo } from "react";
import { Animated as RNAnimated, Text, View } from "react-native";
import Animated, { SharedValue } from "react-native-reanimated";

import { spacing, typography, createStyles } from "@/lib/theme";
import { walletFace } from "@/lib/wallet-colors";
import { Wallet } from "@/features/wallets/types";
import {
  CARD_HEIGHT,
  CARD_OVERLAP,
  CAROUSEL_SHADOW_BLEED_BOTTOM,
  CAROUSEL_SHADOW_BLEED_TOP,
  WalletStackCard,
} from "@/features/wallets/components/WalletStackCard";
import { SNAP_INTERVAL, useWalletCarousel } from "@/features/wallets/components/use-wallet-carousel";
import { useCardMotion, useCardPress, useCarouselIntro } from "@/features/wallets/components/wallet-carousel-motion";
import { WalletCarouselPager } from "@/features/wallets/components/WalletCarouselPager";

// Each card's colour: the one its owner picked, else one from its position
// in the list (walletFace, src/lib/wallet-colors.ts).
const accentFor = (wallets: Wallet[], index: number) =>
  walletFace(wallets[index]?.color, index, wallets.length);

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
  highlightOpacity?: RNAnimated.Value;
}

interface CarouselCardProps {
  wallet: Wallet;
  index: number;
  isLast: boolean;
  accentColor: string;
  scrollX: SharedValue<number>;
  intro: SharedValue<number>;
  onPress: () => void;
  highlightOpacity?: RNAnimated.Value;
}

// One card, so each gets its own motion hooks (hooks cannot run in a loop).
function CarouselCard({ wallet, index, isLast, accentColor, scrollX, intro, onPress, highlightOpacity }: CarouselCardProps) {
  const press = useCardPress();
  const motion = useCardMotion(index, scrollX, intro, press.pressed);
  return (
    <WalletStackCard
      wallet={wallet}
      accentColor={accentColor}
      motion={motion}
      // The final card keeps its full width so the scrollable content is
      // exactly long enough to bring it to the middle.
      layoutStyle={{ marginRight: isLast ? 0 : -CARD_OVERLAP }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      highlightOpacity={highlightOpacity}
    />
  );
}

/**
 * The wallets section: the selected wallet centred, its neighbours tucked
 * behind it on both sides and turned away, wrapping around at either end,
 * with a ‹ • ━ • › pager under it. Shared by Home and the Wallets screen's
 * card view, so a wallet keeps the same accent color on both. On first
 * layout the cards are dealt out from a stack under the centre one
 * (useCarouselIntro).
 *
 * ⚠️ A plain ScrollView rather than a FlatList, deliberately. Looping means
 * silently jumping the scroll offset by a whole copy's width once the user
 * reaches an edge, and doing that through a virtualised list means fighting
 * its windowing every time. Wallet counts are small enough that rendering
 * every card outright is cheaper than the machinery to avoid it.
 *
 * The OS owns the scroll, so fling physics and the host screen's own vertical
 * scroll both keep working. Cards and pager dots all run off one Reanimated
 * scroll value on the UI thread, paint order included, so nothing about a
 * swipe waits on a React render (2026-10-14: the native-driver version still
 * flashed on a quick flick, its paint order being React state).
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
    scrollHandler,
    containerWidth,
    centreIndex,
    rendered,
    sidePadding,
    onLayout,
    onContentSizeChange,
    pressCard,
    step,
    looping,
  } = useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange });
  // Cards are only rendered once the width is known, so that is when the deck
  // is dealt.
  const intro = useCarouselIntro(containerWidth > 0 && wallets.length > 0);

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
          // Scroll, drag start and momentum end, all in one UI-thread handler.
          onScroll={scrollHandler}
        >
          {containerWidth === 0
            ? null
            : rendered.map((wallet, index) => (
                <CarouselCard
                  // Index, not wallet id — the loop copies repeat every id.
                  key={`${wallet.id}-${index}`}
                  wallet={wallet}
                  index={index}
                  isLast={index === rendered.length - 1}
                  accentColor={accentFor(wallets, index % wallets.length)}
                  scrollX={scrollX}
                  intro={intro}
                  // A side card is a shortcut for the swipe that would bring it
                  // over; only the card already in the middle is "opened".
                  onPress={() => pressCard(index, onPressWallet ? () => onPressWallet(wallet) : undefined)}
                  // Every loop copy of the wallet gets it — whichever copy is
                  // centred is the one the user sees.
                  highlightOpacity={wallet.id === highlightWalletId ? highlightOpacity : undefined}
                />
              ))}
        </Animated.ScrollView>
      </View>

      <WalletCarouselPager
        dotCount={wallets.length}
        // The active dot wears its wallet's card colour, tying the bar to the card above it.
        dotColors={wallets.map((_, i) => accentFor(wallets, i))}
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
