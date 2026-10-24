import { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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
const BAR_PADDING = 3;
// Both chevrons, the gaps beside them and the bar's own padding.
const BAR_CHROME = BUTTON * 2 + spacing.xs * 2 + BAR_PADDING * 2;
// The bar never takes more than this share of the carousel's width. Past
// it the dots window around the centred card, with a "…" on each side that
// has more.
const MAX_WIDTH_RATIO = 0.7;
const MIN_VISIBLE_DOTS = 3;
const ELLIPSIS_DOT = 3;
const ELLIPSIS_GAP = 2;
const ELLIPSIS_WIDTH = ELLIPSIS_DOT * 3 + ELLIPSIS_GAP * 2;
// How fast the window catches up when it jumps (across the loop's seam).
const WINDOW_GLIDE_MS = 160;

const dotsWidth = (count: number) => count * STEP - DOT_GAP + EDGE * 2;

// How many dots fit in the bar at `areaWidth`; all of them when they fit.
function visibleDotCount(dotCount: number, areaWidth: number): number {
  const maxWidth = areaWidth * MAX_WIDTH_RATIO;
  if (BAR_CHROME + dotsWidth(dotCount) <= maxWidth) return dotCount;
  const room = maxWidth - BAR_CHROME - (ELLIPSIS_WIDTH + spacing.xs) * 2;
  return Math.min(dotCount, Math.max(MIN_VISIBLE_DOTS, Math.floor((room + DOT_GAP - EDGE * 2) / STEP)));
}

// The centred card's place along the dots, 0..dotCount-1, mid-swipe included.
function dotPosition(scrollX: number, dotCount: number, looping: boolean): number {
  "worklet";
  const raw = scrollX / SNAP_INTERVAL;
  return looping ? ((raw % dotCount) + dotCount) % dotCount : Math.min(Math.max(raw, 0), dotCount - 1);
}

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
    const position = dotPosition(scrollX.value, dotCount, looping);
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

/** "…" at one end of a windowed row: there are more dots that way. */
function Ellipsis({ fade }: { fade: ComponentProps<typeof Animated.View>["style"] }) {
  const styles = useStyles();
  return (
    <Animated.View style={[styles.ellipsis, fade]}>
      <View style={styles.ellipsisDot} />
      <View style={styles.ellipsisDot} />
      <View style={styles.ellipsisDot} />
    </Animated.View>
  );
}

/**
 * Which dots show when they do not all fit: `visible` of them, kept centred
 * on the active one and stopping at either end, so the active capsule is
 * always in view. The window follows the scroll frame by frame and glides,
 * rather than jumps, when it has to cross the whole row (the loop's seam).
 */
function useDotWindow(dotCount: number, visible: number, looping: boolean, scrollX: SharedValue<number>) {
  const offset = useSharedValue(0);
  const gliding = useSharedValue(false);
  const lastStart = dotCount - visible;

  useAnimatedReaction(
    () => {
      if (lastStart <= 0) return 0;
      const position = dotPosition(scrollX.value, dotCount, looping);
      return Math.min(Math.max(position - (visible - 1) / 2, 0), lastStart);
    },
    (target, previous) => {
      if (previous !== null && (gliding.value || Math.abs(target - previous) > 1)) {
        gliding.value = true;
        offset.value = withTiming(target, { duration: WINDOW_GLIDE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) gliding.value = false;
        });
        return;
      }
      offset.value = target;
    },
    [dotCount, visible, looping, lastStart],
  );

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: -offset.value * STEP }] }));
  const moreBefore = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(offset.value, 0), 1) }));
  const moreAfter = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(lastStart - offset.value, 0), 1) }));
  return { row, moreBefore, moreAfter, windowed: lastStart > 0 };
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
  /** The carousel's width; the bar takes at most MAX_WIDTH_RATIO of it. 0 = not measured yet. */
  areaWidth: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

/** The ‹ • ━ • › bar under the wallet cards, ‹ … • ━ • … › when it has more dots than room. */
export function WalletCarouselPager({
  dotCount,
  dotColors,
  positionCount,
  looping,
  scrollX,
  areaWidth,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: WalletCarouselPagerProps) {
  const styles = useStyles();
  const colors = useColors();
  // Not before the width is known: the bar could not tell yet how many dots fit.
  const hasDots = dotCount >= 2 && positionCount >= 2 && areaWidth > 0;
  const activeColors = dotColors && dotColors.length === dotCount ? dotColors : Array(dotCount).fill(colors.textPrimary);
  const visible = visibleDotCount(dotCount, areaWidth);
  const dotWindow = useDotWindow(dotCount, visible, looping, scrollX);

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

          {dotWindow.windowed ? <Ellipsis fade={dotWindow.moreBefore} /> : null}

          {/* Position is already announced by the carousel's own label. The
              dots stay put (or slide as one row when windowed); only the
              capsule over them moves. */}
          <View
            style={[styles.dots, { width: dotsWidth(visible) }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View style={[styles.dotRow, { width: dotsWidth(dotCount) }, dotWindow.row]}>
              {Array.from({ length: dotCount }, (_, dot) => (
                <View key={dot} style={[styles.dot, { left: EDGE + dot * STEP }]} />
              ))}
              <ActiveCapsule dotCount={dotCount} looping={looping} scrollX={scrollX} colors={activeColors} />
              {looping ? (
                <ActiveCapsule dotCount={dotCount} looping scrollX={scrollX} colors={activeColors} twin />
              ) : null}
            </Animated.View>
          </View>

          {dotWindow.windowed ? <Ellipsis fade={dotWindow.moreAfter} /> : null}

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
    paddingHorizontal: BAR_PADDING,
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
  // Clips the capsule and its twin as they cross the loop's seam, and the
  // dots outside the window.
  dots: { height: DOT, overflow: "hidden" },
  dotRow: { position: "absolute", top: 0, left: 0, height: DOT },
  dot: { position: "absolute", top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.trackMuted },
  capsule: { position: "absolute", top: 0, left: 0, height: DOT, borderRadius: DOT / 2 },
  ellipsis: { flexDirection: "row", alignItems: "center", gap: ELLIPSIS_GAP, width: ELLIPSIS_WIDTH },
  ellipsisDot: { width: ELLIPSIS_DOT, height: ELLIPSIS_DOT, borderRadius: ELLIPSIS_DOT / 2, backgroundColor: colors.trackMuted },
}));
