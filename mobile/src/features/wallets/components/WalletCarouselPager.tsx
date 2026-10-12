import { useMemo } from "react";
import { Animated, Pressable, View } from "react-native";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, createStyles, useColors } from "@/lib/theme";
import { SNAP_INTERVAL } from "@/features/wallets/components/use-wallet-carousel";
import { CAROUSEL_SHADOW_BLEED_BOTTOM } from "@/features/wallets/components/WalletStackCard";

const DOT = 6;
// The active dot stretches into a pill this wide, pushing the dots after it
// along by the difference.
const PILL = 18;
const STRETCH = PILL - DOT;
const DOT_GAP = 6;
const BUTTON = 28;
// A zero scale is a singular transform; the collapsed middle is kept at a
// sliver too thin to show instead.
const COLLAPSED = 0.001;

// Fixed height whatever the wallet count, including one wallet (no pager
// drawn), so the content below never moves. WalletCardSkeleton reserves it.
export const PAGER_HEIGHT = 36;
// Card bottom to pager top is 14px. The carousel's scroll box ends below the
// card by its shadow bleed, so the pager is pulled back up into that bleed.
export const PAGER_OFFSET_TOP = 14 - CAROUSEL_SHADOW_BLEED_BOTTOM;

/**
 * Per-dot motion, all on the native driver and keyed off the carousel's own
 * scroll position, so the dots track the finger frame by frame.
 *
 * Width and position are layout, which the native driver cannot animate, so
 * each dot is drawn as two half-caps and a middle piece: the middle scales
 * out from the left cap and the right cap rides its end. The row's re-flow
 * is a translate: every dot after the active one shifts right by STRETCH.
 *
 * Keyed on every rendered position (the loop copies too), not on the wallet
 * index: across the loop seam the last dot shrinks while the first grows,
 * and linear interpolation between neighbouring positions gives exactly the
 * in-between widths and shifts.
 */
function useDotMotion(dotCount: number, positionCount: number, scrollX: Animated.Value) {
  return useMemo(() => {
    if (dotCount < 2 || positionCount < 2) return [];
    const position = Animated.divide(scrollX, SNAP_INTERVAL);
    const inputRange = Array.from({ length: positionCount }, (_, i) => i);
    const along = (values: number[]) =>
      position.interpolate({ inputRange, outputRange: values, extrapolate: "clamp" });

    return Array.from({ length: dotCount }, (_, dot) => {
      const active = inputRange.map((i) => (i % dotCount === dot ? 1 : 0));
      const activeIsBefore = inputRange.map((i) => (i % dotCount < dot ? 1 : 0));
      return {
        shift: along(activeIsBefore.map((v) => v * STRETCH)),
        // Scales around its own centre, so it is moved back by the half it lost.
        middleShift: along(active.map((v) => -(1 - v) * (STRETCH / 2))),
        middleScale: along(active.map((v) => Math.max(COLLAPSED, v))),
        capShift: along(active.map((v) => v * STRETCH)),
        active: along(active),
      };
    });
  }, [dotCount, positionCount, scrollX]);
}

type DotMotion = ReturnType<typeof useDotMotion>[number];

function Capsule({ motion, color }: { motion: DotMotion; color: string }) {
  const styles = useStyles();
  return (
    <>
      <View style={[styles.capLeft, { backgroundColor: color }]} />
      <Animated.View
        style={[
          styles.middle,
          { backgroundColor: color, transform: [{ translateX: motion.middleShift }, { scaleX: motion.middleScale }] },
        ]}
      />
      <Animated.View style={[styles.capRight, { backgroundColor: color, transform: [{ translateX: motion.capShift }] }]} />
    </>
  );
}

interface WalletCarouselPagerProps {
  /** Distinct wallets — one dot each. */
  dotCount: number;
  /** Rendered cards, loop copies included. */
  positionCount: number;
  scrollX: Animated.Value;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

/** The ‹ • ━ • › bar under the wallet cards. */
export function WalletCarouselPager({
  dotCount,
  positionCount,
  scrollX,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: WalletCarouselPagerProps) {
  const styles = useStyles();
  const colors = useColors();
  const dots = useDotMotion(dotCount, positionCount, scrollX);

  return (
    // box-none: the slot overlaps the cards' bottom shadow bleed and must not
    // swallow touches there, only the bar itself takes them.
    <View style={styles.slot} pointerEvents="box-none">
      {dots.length > 0 ? (
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

          {/* Position is already announced by each card's own label. */}
          <View
            style={[styles.dots, { width: dotCount * DOT + (dotCount - 1) * DOT_GAP + STRETCH }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {dots.map((motion, index) => (
              <Animated.View
                key={index}
                style={[styles.dot, { left: index * (DOT + DOT_GAP), transform: [{ translateX: motion.shift }] }]}
              >
                <Capsule motion={motion} color={colors.trackMuted} />
                <Animated.View style={[styles.dotActive, { opacity: motion.active }]}>
                  <Capsule motion={motion} color={colors.textPrimary} />
                </Animated.View>
              </Animated.View>
            ))}
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: PAGER_HEIGHT,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
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
  dots: { height: DOT },
  dot: { position: "absolute", top: 0, width: PILL, height: DOT },
  dotActive: { position: "absolute", top: 0, left: 0, width: PILL, height: DOT },
  // Half-circles, so no two pieces overlap: the colors are translucent, and
  // an overlap would show as a brighter seam.
  capLeft: {
    position: "absolute",
    left: 0,
    width: DOT / 2,
    height: DOT,
    borderTopLeftRadius: DOT / 2,
    borderBottomLeftRadius: DOT / 2,
  },
  middle: { position: "absolute", left: DOT / 2, width: STRETCH, height: DOT },
  capRight: {
    position: "absolute",
    left: DOT / 2,
    width: DOT / 2,
    height: DOT,
    borderTopRightRadius: DOT / 2,
    borderBottomRightRadius: DOT / 2,
  },
}));
