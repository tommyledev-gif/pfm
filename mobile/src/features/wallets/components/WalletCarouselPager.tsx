import { Pressable, View } from "react-native";
import Animated, { SharedValue, interpolateColor, useAnimatedStyle } from "react-native-reanimated";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, createStyles, useColors } from "@/lib/theme";
import { SNAP_INTERVAL } from "@/features/wallets/components/use-wallet-carousel";
import { CAROUSEL_SHADOW_BLEED_BOTTOM } from "@/features/wallets/components/WalletStackCard";

const DOT = 6;
const DOT_GAP = 8;
const STEP = DOT + DOT_GAP;
// The capsule marking the centred card, and how much longer it draws out
// halfway between two dots, so a swipe reads as it travelling, not blinking.
const PILL = 18;
const PILL_STRETCH = 8;
// Room past the outer dots for the capsule, which is wider than a dot.
const EDGE = (PILL - DOT) / 2;
const BUTTON = 28;

// Fixed height whatever the wallet count, including one wallet (no pager
// drawn), so the content below never moves. WalletCardSkeleton reserves it.
export const PAGER_HEIGHT = 36;
// Card bottom to pager top is 14px. The carousel's scroll box ends below the
// card by its shadow bleed, so the pager is pulled back up into that bleed.
export const PAGER_OFFSET_TOP = 14 - CAROUSEL_SHADOW_BLEED_BOTTOM;

interface ActiveCapsuleProps {
  dotCount: number;
  looping: boolean;
  scrollX: SharedValue<number>;
  /** The active colour of each dot, by wallet index. */
  colors: string[];
  /** The twin that slides in from the far side across the loop's seam. */
  twin?: boolean;
}

/**
 * The one capsule that marks the centred card, sliding along the dots with
 * the scroll frame by frame (the carousel's own Reanimated value), drawing
 * out a little mid-way and blending from one wallet's colour into the next.
 *
 * Across the loop's seam (last wallet → first) it keeps going: it slides out
 * past the last dot while its twin slides in before the first, the row
 * clipping both, so it never jumps back across the whole bar.
 */
function ActiveCapsule({ dotCount, looping, scrollX, colors, twin = false }: ActiveCapsuleProps) {
  const styles = useStyles();
  const style = useAnimatedStyle(() => {
    const raw = scrollX.value / SNAP_INTERVAL;
    const position = looping ? ((raw % dotCount) + dotCount) % dotCount : Math.min(Math.max(raw, 0), dotCount - 1);
    const index = Math.floor(position);
    const frac = position - index;
    const shift = twin ? position - dotCount : position;
    const width = PILL + PILL_STRETCH * Math.sin(Math.PI * frac);
    return {
      width,
      transform: [{ translateX: EDGE + shift * STEP + DOT / 2 - width / 2 }],
      backgroundColor: interpolateColor(frac, [0, 1], [colors[index] ?? colors[0], colors[(index + 1) % dotCount] ?? colors[0]]),
    };
  });
  return <Animated.View style={[styles.capsule, style]} />;
}

interface WalletCarouselPagerProps {
  /** Distinct wallets — one dot each. */
  dotCount: number;
  /** Each dot's colour while active, by wallet index. */
  dotColors?: string[];
  /** Rendered cards, loop copies included. */
  positionCount: number;
  /** The carousel wraps around: the capsule slides across the seam. */
  looping: boolean;
  scrollX: SharedValue<number>;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

/** The ‹ • ━ • › bar under the wallet cards. */
export function WalletCarouselPager({
  dotCount,
  dotColors,
  positionCount,
  looping,
  scrollX,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: WalletCarouselPagerProps) {
  const styles = useStyles();
  const colors = useColors();
  const hasDots = dotCount >= 2 && positionCount >= 2;
  const activeColors = dotColors && dotColors.length === dotCount ? dotColors : Array(dotCount).fill(colors.textPrimary);

  return (
    // box-none: the slot overlaps the cards' bottom shadow bleed and must not
    // swallow touches there, only the bar itself takes them.
    <View style={styles.slot} pointerEvents="box-none">
      {hasDots ? (
        <View style={styles.bar}>
          <Pressable
            onPress={onBack}
            disabled={!canGoBack}
            hitSlop={6}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, !canGoBack && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Ví trước"
            accessibilityState={{ disabled: !canGoBack }}
          >
            <ChevronLeftIcon size={16} color={colors.textPrimary} />
          </Pressable>

          {/* Position is already announced by the carousel's own label. The
              dots stay put; only the capsule over them moves. */}
          <View
            style={[styles.dots, { width: dotCount * DOT + (dotCount - 1) * DOT_GAP + EDGE * 2 }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: dotCount }, (_, dot) => (
              <View key={dot} style={[styles.dot, { left: EDGE + dot * STEP }]} />
            ))}
            <ActiveCapsule dotCount={dotCount} looping={looping} scrollX={scrollX} colors={activeColors} />
            {looping ? (
              <ActiveCapsule dotCount={dotCount} looping scrollX={scrollX} colors={activeColors} twin />
            ) : null}
          </View>

          <Pressable
            onPress={onForward}
            disabled={!canGoForward}
            hitSlop={6}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, !canGoForward && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Ví tiếp theo"
            accessibilityState={{ disabled: !canGoForward }}
          >
            <ChevronRightIcon size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  slot: {
    height: PAGER_HEIGHT,
    marginTop: PAGER_OFFSET_TOP,
    alignItems: "center",
    justifyContent: "center",
  },
  // A soft fill, no outline: it is a control, not another card.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: PAGER_HEIGHT,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { backgroundColor: withAlpha(colors.overlayBase, 0.08) },
  buttonDisabled: { opacity: 0.3 },
  // Clips the capsule and its twin as they cross the loop's seam.
  dots: { height: DOT, overflow: "hidden" },
  dot: { position: "absolute", top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.trackMuted },
  capsule: { position: "absolute", top: 0, left: 0, height: DOT, borderRadius: DOT / 2 },
}));
