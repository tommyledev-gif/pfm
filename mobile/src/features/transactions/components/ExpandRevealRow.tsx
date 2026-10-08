import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import { DAY_TOGGLE_ANIMATION_MS } from "@/features/transactions/hooks/use-collapsed-days";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// How far a revealed row drops in from — just enough to read as coming out
// from under its day header.
const REVEAL_OFFSET = -6;

interface ExpandRevealRowProps {
  /** True when this row is mounting because its day was just unfolded. Read
   *  once, at mount — a row that is already on screen never replays it. */
  revealing: boolean;
  children: ReactNode;
}

/**
 * One row of a Transactions day, easing in (fade + short drop) when it
 * appears because the user unfolded its day.
 *
 * ⚠️ Folding is NOT animated here, on purpose. The rows used to stay mounted
 * and animate their own height to zero, which broke twice inside the
 * SectionList: the list's `gap` lives between its cell wrappers, out of reach
 * of a negative margin on the row inside, so every hidden row still left a
 * gap behind (ten rows ≈ 120dp of blank space); and a row folded before it was
 * ever measured had no height to grow back to, so unfolding left the blank
 * space empty. A folded day now hands the list no rows at all, which makes
 * both cases correct by construction — and this only has to animate opacity
 * and translateY, both on the native driver.
 */
export function ExpandRevealRow({ revealing, children }: ExpandRevealRowProps) {
  const reduceMotion = useReduceMotion();
  const [animateIn] = useState(revealing);
  const progress = useRef(new Animated.Value(animateIn ? 0 : 1)).current;

  useEffect(() => {
    if (!animateIn) return;
    // useReduceMotion resolves asynchronously after mount — when it lands as
    // true, cut whatever already started straight to the end state.
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DAY_TOGGLE_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animateIn, reduceMotion, progress]);

  if (!animateIn) return <>{children}</>;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [REVEAL_OFFSET, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}
