import { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import {
  STACK_CARD_HEIGHT,
  STACK_CARD_WIDTH,
  WalletStackCard,
} from "@/features/wallets/components/WalletStackCard";

// How far to the right each card behind the front one sits. Small enough that
// several cards still read as one stack, large enough that each is visibly
// its own card.
const STACK_PEEK_OFFSET = 26;
// ⚠️ Cards deeper than this stop moving. Without a cap the offsets accumulate
// and a user with a dozen wallets pushes the back of the stack off screen —
// the cards are still reachable by scrolling, but the stack stops looking
// like one and starts looking like a broken row.
const STACK_MAX_VISIBLE_DEPTH = 3;
const STACK_SCALE_STEP = 0.06;
const STACK_OPACITY_STEP = 0.25;
// One card plus its peek — the scroll distance that advances the stack by one.
const SNAP_INTERVAL = STACK_CARD_WIDTH;

interface WalletCarouselProps {
  wallets: Wallet[];
}

/**
 * The wallets section, as an overlapping card stack.
 *
 * ⚠️ The horizontal scroll view underneath is what actually holds the
 * positions — the cards are absolutely positioned and driven from its offset,
 * so the OS owns the fling physics and the vertical scroll of the home screen
 * underneath is never captured. Building the paging by hand on a PanResponder
 * would have had to fight the parent list for every gesture.
 *
 * No reanimated and no gesture-handler: neither is a dependency of this
 * project, so this is core Animated with the native driver.
 */
export function WalletCarousel({ wallets }: WalletCarouselProps) {
  const scrollX = useRef(new Animated.Value(0)).current;

  if (wallets.length === 0) {
    return <Text style={styles.empty}>Chưa có ví nào — thêm một ví để bắt đầu.</Text>;
  }

  return (
    <View testID="carousel-wallets" style={styles.container}>
      <View style={styles.stack} pointerEvents="none">
        {/* Reversed so the first wallet paints last and therefore on top —
            React Native has no z-index ordering that survives a transform as
            reliably as paint order does. */}
        {wallets
          .map((wallet, index) => ({ wallet, index }))
          .reverse()
          .map(({ wallet, index }) => {
          // Depth relative to the current scroll position: 0 is the front
          // card, higher numbers sit further back.
          const depth = Animated.subtract(index, Animated.divide(scrollX, SNAP_INTERVAL));
          const clampedDepth = depth.interpolate({
            inputRange: [0, STACK_MAX_VISIBLE_DEPTH],
            outputRange: [0, STACK_MAX_VISIBLE_DEPTH],
            extrapolateLeft: "extend",
            extrapolateRight: "clamp",
          });

          return (
            <WalletStackCard
              key={wallet.id}
              wallet={wallet}
              isFront={index === 0}
              animatedStyle={{
                transform: [
                  {
                    translateX: clampedDepth.interpolate({
                      inputRange: [0, STACK_MAX_VISIBLE_DEPTH],
                      outputRange: [0, STACK_PEEK_OFFSET * STACK_MAX_VISIBLE_DEPTH],
                    }),
                  },
                  {
                    scale: clampedDepth.interpolate({
                      inputRange: [0, STACK_MAX_VISIBLE_DEPTH],
                      outputRange: [1, 1 - STACK_SCALE_STEP * STACK_MAX_VISIBLE_DEPTH],
                    }),
                  },
                ],
                opacity: clampedDepth.interpolate({
                  inputRange: [0, STACK_MAX_VISIBLE_DEPTH],
                  outputRange: [1, Math.max(0, 1 - STACK_OPACITY_STEP * STACK_MAX_VISIBLE_DEPTH)],
                }),
              }}
            />
          );
        })}
      </View>

      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        // Only the horizontal axis is claimed, so the home screen's own
        // vertical scroll still works over the stack.
        directionalLockEnabled
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ width: SNAP_INTERVAL * wallets.length }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A fixed height regardless of wallet count, so the content below does not
  // shift as the wallets load.
  container: { height: STACK_CARD_HEIGHT, marginBottom: spacing.xs },
  stack: { ...StyleSheet.absoluteFillObject },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
});
