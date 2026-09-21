import { useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, spacing, typography } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { CARD_GAP, CARD_HEIGHT, CARD_WIDTH, WalletStackCard } from "@/features/wallets/components/WalletStackCard";

const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
// How far a neighbour leans inward, on top of the layout gap, so the flanking
// cards tuck under the active one and the row reads as a stack rather than a
// filmstrip.
const NEIGHBOUR_OVERLAP = 18;
const NEIGHBOUR_SCALE = 0.88;
const NEIGHBOUR_OPACITY = 0.5;
// ⚠️ Looping needs enough wallets that the copies never put the same wallet on
// screen twice. With the active card plus one neighbour each side visible,
// three distinct wallets is the floor; below it this is a plain bounded list.
const MIN_WALLETS_TO_LOOP = 3;
const LOOP_COPIES = 3;

interface WalletCarouselProps {
  wallets: Wallet[];
}

/**
 * The wallets section: the selected wallet centred, its neighbours peeking on
 * both sides, wrapping around at either end.
 *
 * ⚠️ A plain ScrollView rather than a FlatList, deliberately. Looping means
 * silently jumping the scroll offset by a whole copy's width once the user
 * reaches an edge, and doing that through a virtualised list means fighting
 * its windowing every time. Wallet counts are small enough that rendering
 * every card outright is cheaper than the machinery to avoid it.
 *
 * The OS owns the scroll, so fling physics and the home screen's own vertical
 * scroll both keep working. No reanimated and no gesture-handler — neither is
 * a dependency of this project.
 */
export function WalletCarousel({ wallets }: WalletCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const didInitialScroll = useRef(false);

  const looping = wallets.length >= MIN_WALLETS_TO_LOOP;
  // Three copies laid end to end. The user always sits in the middle one, so
  // there is a full copy of runway in either direction before a jump is owed.
  const rendered = looping ? Array.from({ length: LOOP_COPIES }, () => wallets).flat() : wallets;
  const loopWidth = wallets.length * SNAP_INTERVAL;

  // Side padding is what actually centres a card: the first and last items
  // need half a viewport of empty space beside them to reach the middle.
  const sidePadding = containerWidth > 0 ? Math.max(0, (containerWidth - CARD_WIDTH) / 2) : 0;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setContainerWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  // Landing in the middle copy has to happen without animation, or the user
  // watches the carousel scroll itself on arrival.
  const onContentSizeChange = () => {
    if (didInitialScroll.current || !looping || containerWidth === 0) return;
    didInitialScroll.current = true;
    scrollRef.current?.scrollTo({ x: loopWidth, animated: false });
  };

  // ⚠️ The wrap happens only once motion has stopped. Re-anchoring mid-fling
  // would cancel the user's own momentum and read as the carousel snatching
  // the card back.
  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!looping) return;
    const x = event.nativeEvent.contentOffset.x;
    if (x < loopWidth / 2) scrollRef.current?.scrollTo({ x: x + loopWidth, animated: false });
    else if (x > loopWidth * 1.5) scrollRef.current?.scrollTo({ x: x - loopWidth, animated: false });
  };

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
        contentContainerStyle={{ paddingHorizontal: sidePadding, gap: CARD_GAP }}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      >
        {containerWidth === 0
          ? null
          : rendered.map((wallet, index) => {
              // Where this card sits relative to the viewport's centre, in
              // snap intervals: -1 is one card left of centre, 0 is centred.
              const offsetFromCentre = Animated.subtract(index, Animated.divide(scrollX, SNAP_INTERVAL));
              const range = [-1, 0, 1];

              return (
                <WalletStackCard
                  // Index, not wallet id — the loop copies repeat every id.
                  key={`${wallet.id}-${index}`}
                  wallet={wallet}
                  animatedStyle={{
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
                  // Fades the tint and accent border in on whichever card is
                  // centred, without re-rendering on every scroll frame.
                  activeOpacity={offsetFromCentre.interpolate({
                    inputRange: [-0.6, 0, 0.6],
                    outputRange: [0, 1, 0],
                    extrapolate: "clamp",
                  })}
                />
              );
            })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // A fixed height regardless of wallet count, so content below does not shift
  // as the wallets load. Full-bleed: the section's own horizontal padding is
  // cancelled so a neighbour can sit under the screen edge.
  container: { height: CARD_HEIGHT, marginHorizontal: -spacing.xl },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
});
