import { ComponentProps, ReactNode, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SPRING, staggerDelay } from "@/components/motion/motion-tokens";
import { spacing, createStyles } from "@/lib/theme";
import { DAY_FOLD_MS } from "@/features/transactions/hooks/use-collapsed-days";

// How far a revealed row drops in from: it reads as coming out from under
// the row (or the day header) above it.
const REVEAL_OFFSET = -10;
// The box's cap while the row is open: taller than any row, so no cap at all.
const NO_CAP = 10000;
const FOLD_TIMING = { duration: DAY_FOLD_MS, easing: Easing.inOut(Easing.cubic) };
// Clamped so the box never grows past the row and back.
const REVEAL_SPRING = { ...SPRING, overshootClamping: true };

type Entering = ComponentProps<typeof Animated.View>["entering"];

interface DayFoldRowProps {
  /** The row's day is folding: shrink to nothing (the list drops it after). */
  folding: boolean;
  /** Mounting because its day was just unfolded. Read once, at mount. */
  revealing: boolean;
  /** Position in its day, so an unfolding day's rows grow in one after another. */
  index: number;
  reduceMotion: boolean;
  /** The list's own entrance: useListEntrance for a new result set,
   *  useAppendEntrance for a row the next page brought. */
  entering?: Entering;
  children: ReactNode;
}

/**
 * One row of a Transactions day, folding away with its day and growing back
 * when the day is opened: a clipping box whose height runs between zero and
 * the row's own measured height (animate-ui's Collapsible), on the UI thread,
 * so the rows below slide instead of jumping.
 *
 * ⚠️ The row's spacing lives inside the box (`content`'s paddingTop), not in
 * the list's `gap`. A gap sits between the list's cell wrappers, out of reach
 * of anything inside them: a row at zero height still left a gap behind, and
 * every folded day kept a blank strip. The screen spaces its other cells the
 * same way (transactions.tsx), so the list looks exactly as it did with gap.
 *
 * The box's limit is a maxHeight, not a height: open, it is effectively no
 * limit at all, so the row keeps its natural height (a note edited to two
 * lines grows the row) and nothing waits on a measurement. A row only needs
 * measuring once it moves; it is measured from its first layout on.
 */
export function DayFoldRow({ folding, revealing, index, reduceMotion, entering, children }: DayFoldRowProps) {
  const styles = useStyles();
  // A row mounting into an unfold (or into a day already folding) starts shut.
  const [startsShut] = useState(folding || (revealing && !reduceMotion));
  // Only read at mount, like Reanimated itself does: freezing it keeps the
  // wrapper below from coming or going (a remount) when the window closes.
  const [enterAnimation] = useState(() => entering);
  const progress = useSharedValue(startsShut ? 0 : 1);
  const contentHeight = useSharedValue(0);
  // Where progress is heading, so a re-render that changes nothing starts no
  // animation (every idle row would otherwise run a spring on mount).
  const heading = useRef(startsShut ? 0 : 1);

  useEffect(() => {
    const target = folding ? 0 : 1;
    if (reduceMotion) {
      heading.current = target;
      progress.value = target;
      return;
    }
    if (heading.current === target) return;
    heading.current = target;
    progress.value = folding
      ? withTiming(0, FOLD_TIMING)
      : withDelay(startsShut ? staggerDelay(index) : 0, withSpring(1, REVEAL_SPRING));
    // `index` is read for the first reveal only; a row moving within its day
    // has no reason to restart anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folding, reduceMotion, progress, startsShut]);

  const boxStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (p >= 1) return { maxHeight: NO_CAP, opacity: 1 };
    return { maxHeight: Math.max(0, contentHeight.value * p), opacity: Math.max(0, p) };
  });
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value >= 1 ? 0 : (1 - progress.value) * REVEAL_OFFSET }],
  }));

  const onContentLayout = (e: LayoutChangeEvent) => {
    contentHeight.value = e.nativeEvent.layout.height;
  };

  return (
    <Animated.View
      style={[styles.box, boxStyle]}
      pointerEvents={folding ? "none" : "auto"}
      importantForAccessibility={folding ? "no-hide-descendants" : "auto"}
    >
      <Animated.View style={[styles.content, contentStyle]} onLayout={onContentLayout}>
        {/* Its own view: an entering animation drives opacity and transform,
            which the two boxes above already animate for the fold. */}
        {enterAnimation ? <Animated.View entering={enterAnimation}>{children}</Animated.View> : children}
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // Widened by the bleed below, so the clip leaves room for the focus border
  // TransactionRow draws just outside itself.
  box: { overflow: "hidden", marginHorizontal: -spacing.sm },
  // The space above the row, which the list's gap used to give it.
  content: { paddingTop: spacing.md, paddingHorizontal: spacing.sm },
}));
