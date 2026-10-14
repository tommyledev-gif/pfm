import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from "react-native-reanimated";

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
 * One dot's motion, on the UI thread and keyed off the carousel's own scroll
 * position (the same Reanimated value the cards read), so the dots track the
 * finger frame by frame.
 *
 * Width is layout, so each dot is drawn as two half-caps and a middle piece:
 * the middle scales out from the left cap and the right cap rides its end.
 * The row's re-flow is a translate: every dot after the active one shifts
 * right by STRETCH.
 *
 * Keyed on every rendered position (the loop copies too), not on the wallet
 * index: across the loop seam the last dot shrinks while the first grows,
 * and linear interpolation between neighbouring positions gives exactly the
 * in-between widths and shifts.
 */
function useDotMotion(dot: number, dotCount: number, positionCount: number, scrollX: SharedValue<number>) {
  const ranges = useMemo(() => {
    const input = Array.from({ length: positionCount }, (_, i) => i);
    const active = input.map((i) => (i % dotCount === dot ? 1 : 0));
    return {
      input,
      active,
      shift: input.map((i) => (i % dotCount < dot ? STRETCH : 0)),
      // Scales around its own centre, so it is moved back by the half it lost.
      middleShift: active.map((v) => -(1 - v) * (STRETCH / 2)),
      middleScale: active.map((v) => Math.max(COLLAPSED, v)),
      capShift: active.map((v) => v * STRETCH),
    };
  }, [dot, dotCount, positionCount]);

  const along = (values: number[]) => {
    "worklet";
    return interpolate(scrollX.value / SNAP_INTERVAL, ranges.input, values, Extrapolation.CLAMP);
  };
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: along(ranges.shift) }] }));
  const middleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: along(ranges.middleShift) }, { scaleX: along(ranges.middleScale) }],
  }));
  const capStyle = useAnimatedStyle(() => ({ transform: [{ translateX: along(ranges.capShift) }] }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: along(ranges.active) }));
  return { dotStyle, middleStyle, capStyle, activeStyle };
}

type DotMotion = ReturnType<typeof useDotMotion>;

function Capsule({ motion, color }: { motion: DotMotion; color: string }) {
  const styles = useStyles();
  return (
    <>
      <View style={[styles.capLeft, { backgroundColor: color }]} />
      <Animated.View style={[styles.middle, { backgroundColor: color }, motion.middleStyle]} />
      <Animated.View style={[styles.capRight, { backgroundColor: color }, motion.capStyle]} />
    </>
  );
}

interface PagerDotProps {
  dot: number;
  dotCount: number;
  positionCount: number;
  scrollX: SharedValue<number>;
}

function PagerDot({ dot, dotCount, positionCount, scrollX }: PagerDotProps) {
  const styles = useStyles();
  const colors = useColors();
  const motion = useDotMotion(dot, dotCount, positionCount, scrollX);
  return (
    <Animated.View style={[styles.dot, { left: dot * (DOT + DOT_GAP) }, motion.dotStyle]}>
      <Capsule motion={motion} color={colors.trackMuted} />
      <Animated.View style={[styles.dotActive, motion.activeStyle]}>
        <Capsule motion={motion} color={colors.textPrimary} />
      </Animated.View>
    </Animated.View>
  );
}

interface WalletCarouselPagerProps {
  /** Distinct wallets — one dot each. */
  dotCount: number;
  /** Rendered cards, loop copies included. */
  positionCount: number;
  scrollX: SharedValue<number>;
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
  const hasDots = dotCount >= 2 && positionCount >= 2;

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

          {/* Position is already announced by each card's own label. */}
          <View
            style={[styles.dots, { width: dotCount * DOT + (dotCount - 1) * DOT_GAP + STRETCH }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: dotCount }, (_, dot) => (
              <PagerDot key={dot} dot={dot} dotCount={dotCount} positionCount={positionCount} scrollX={scrollX} />
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
