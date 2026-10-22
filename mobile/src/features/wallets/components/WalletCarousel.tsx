import { memo, useMemo, useRef } from "react";
import { AccessibilityActionEvent, GestureResponderEvent, Pressable, Animated as RNAnimated, StyleSheet, Text, View } from "react-native";
import Animated, { SharedValue } from "react-native-reanimated";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { walletFace } from "@/lib/wallet-colors";
import { Wallet } from "@/features/wallets/types";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CAROUSEL_SHADOW_BLEED_BOTTOM,
  CAROUSEL_SHADOW_BLEED_TOP,
  WalletStackCard,
} from "@/features/wallets/components/WalletStackCard";
import { SNAP_INTERVAL, useWalletCarousel } from "@/features/wallets/components/use-wallet-carousel";
import {
  cardAtOffset,
  useCardMotion,
  useCarouselIntro,
  useCarouselPress,
} from "@/features/wallets/components/wallet-carousel-motion";
import { WalletCarouselPager } from "@/features/wallets/components/WalletCarouselPager";

// Each card's colour: the one its owner picked, else one from its position
// in the list (walletFace, src/lib/wallet-colors.ts).
const accentFor = (wallets: Wallet[], index: number) =>
  walletFace(wallets[index]?.color, index, wallets.length);

const CARDS_HEIGHT = CARD_HEIGHT + CAROUSEL_SHADOW_BLEED_TOP + CAROUSEL_SHADOW_BLEED_BOTTOM;

const ACCESSIBILITY_ACTIONS = [
  { name: "increment" as const, label: "Ví sau" },
  { name: "decrement" as const, label: "Ví trước" },
  { name: "activate" as const },
];

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
  accentColor: string;
  left: number;
  scrollX: SharedValue<number>;
  centre: SharedValue<number>;
  intro: SharedValue<number>;
  pressTarget: SharedValue<number>;
  pressDepth: SharedValue<number>;
  highlightOpacity?: RNAnimated.Value;
}

// One card, so each gets its own motion hooks (hooks cannot run in a loop).
// Memoized: a swipe changes the centred index, which must not re-render every card.
const CarouselCard = memo(function CarouselCard({
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
}: CarouselCardProps) {
  const motion = useCardMotion(index, scrollX, centre, intro, pressTarget, pressDepth);
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

/**
 * The wallets section: the selected wallet centred, its neighbours tucked
 * behind it on both sides and turned away, wrapping around at either end,
 * with a ‹ • ━ • › pager under it. Shared by Home and the Wallets screen's
 * card view, so a wallet keeps the same accent color on both. On first
 * layout the cards are dealt out from a stack under the centre one
 * (useCarouselIntro).
 *
 * ⚠️ Two layers. The cards are drawn in a plain View, every one laid out dead
 * centre and moved by its transform alone; over them sits a horizontal
 * ScrollView whose content is empty space of the right width. The ScrollView
 * is only the gesture: it owns the drag, the fling and the snap, and its
 * offset (one Reanimated scroll value) drives the cards and the pager dots.
 *
 * The cards used to be the ScrollView's own content, each transform
 * cancelling most of the native scroll to hold the stack in place. The
 * native offset moves on the frame it happens; a transform worked out from
 * the scroll event lands a frame later. So every frame, the card jumped with
 * the content and was then pulled back — a shake at any speed, worst on a
 * quick flick (2026-10-22). Out of the scrolling content, a late frame only
 * means the cards trail the finger by one frame, smoothly.
 *
 * The cards take no touches. The ScrollView's content is one Pressable, and
 * where it was pressed says which card (cardAtOffset): the centred one opens,
 * a neighbour slides over.
 *
 * A plain ScrollView rather than a FlatList: looping means silently jumping
 * the scroll offset by a whole copy's width, and wallet counts are small
 * enough that rendering every card outright is cheaper than windowing.
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
    centre,
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
  const press = useCarouselPress();
  // The card the current touch started on, rendered index; null for empty space.
  const touched = useRef<number | null>(null);
  const dotColors = useMemo(() => wallets.map((_, i) => accentFor(wallets, i)), [wallets]);
  const contentWidth = sidePadding * 2 + Math.max(0, rendered.length - 1) * SNAP_INTERVAL + CARD_WIDTH;

  const cardAt = (event: GestureResponderEvent): number | null => {
    // locationX is in the content's own coordinates; minus the scroll offset
    // it is where on screen the finger is.
    const dx = event.nativeEvent.locationX - scrollX.value - containerWidth / 2;
    const side = cardAtOffset(dx);
    if (side === null) return null;
    const index = Math.round(centre.value) + side;
    return index >= 0 && index < rendered.length ? index : null;
  };
  const handlePressIn = useLatestCallback((event: GestureResponderEvent) => {
    touched.current = cardAt(event);
    if (touched.current !== null) press.pressIn(touched.current);
  });
  const handlePressOut = useLatestCallback(() => press.pressOut());
  // A side card is a shortcut for the swipe that would bring it over; only
  // the card already in the middle is "opened".
  const handlePress = useLatestCallback(() => {
    const index = touched.current;
    if (index === null) return;
    const wallet = rendered[index];
    pressCard(index, onPressWallet && wallet ? () => onPressWallet(wallet) : undefined);
  });
  const handleAccessibilityAction = useLatestCallback((event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") step(1);
    else if (event.nativeEvent.actionName === "decrement") step(-1);
    else if (event.nativeEvent.actionName === "activate") pressCard(centreIndex, () => onPressWallet?.(rendered[centreIndex]));
  });

  if (wallets.length === 0) {
    return <Text style={styles.empty}>Chưa có ví. Tạo ví để ghi giao dịch.</Text>;
  }

  const centred = rendered[centreIndex];
  const cardLeft = Math.max(0, (containerWidth - CARD_WIDTH) / 2);

  return (
    <View testID="carousel-wallets" style={styles.container} onLayout={onLayout}>
      <View style={styles.cards}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {containerWidth === 0
            ? null
            : rendered.map((wallet, index) => (
                <CarouselCard
                  // Index, not wallet id — the loop copies repeat every id.
                  key={`${wallet.id}-${index}`}
                  wallet={wallet}
                  index={index}
                  accentColor={accentFor(wallets, index % wallets.length)}
                  left={cardLeft}
                  scrollX={scrollX}
                  centre={centre}
                  intro={intro}
                  pressTarget={press.target}
                  pressDepth={press.depth}
                  // Every loop copy of the wallet gets it — whichever copy is
                  // centred is the one the user sees.
                  highlightOpacity={wallet.id === highlightWalletId ? highlightOpacity : undefined}
                />
              ))}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          style={StyleSheet.absoluteFill}
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          disableIntervalMomentum
          decelerationRate="fast"
          // Only the horizontal axis is claimed, so the home screen's vertical
          // scroll still works over the cards.
          directionalLockEnabled
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          // Scroll, drag start and momentum end, all in one UI-thread handler.
          onScroll={scrollHandler}
        >
          {containerWidth === 0 ? null : (
            <Pressable
              style={[styles.tapLayer, { width: contentWidth }]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handlePress}
              accessibilityRole="adjustable"
              accessibilityLabel={centred ? `${centred.name}, ${formatCurrency(centred.balance, centred.currency)}` : undefined}
              accessibilityHint="Vuốt lên hoặc xuống để đổi ví, chạm hai lần để mở"
              accessibilityActions={ACCESSIBILITY_ACTIONS}
              onAccessibilityAction={handleAccessibilityAction}
              testID="carousel-wallets-tap"
            />
          )}
        </Animated.ScrollView>
      </View>

      <WalletCarouselPager
        dotCount={wallets.length}
        // The active dot wears its wallet's card colour, tying the bar to the card above it.
        dotColors={dotColors}
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
  cards: { height: CARDS_HEIGHT },
  // Explicit, not "100%": a horizontal ScrollView's content has no definite
  // height for a percentage to resolve against.
  tapLayer: { height: CARDS_HEIGHT },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
}));
