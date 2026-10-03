import { useState } from "react";
import { LayoutAnimation } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// One short motion for a day folding or unfolding: its rows, and every later
// day sliding to its new place. Shared with the header's chevron so the two
// move as one.
export const DAY_TOGGLE_ANIMATION_MS = 220;

const DAY_TOGGLE_ANIMATION = LayoutAnimation.create(
  DAY_TOGGLE_ANIMATION_MS,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

/**
 * Which days of the Transactions list are folded, and the toggle that folds
 * them — animated, unless the OS asks for reduced motion, in which case the
 * change is instant (a faster movement is still movement).
 */
export function useCollapsedDays() {
  const reduceMotion = useReduceMotion();
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const toggleDay = (dayKey: string) => {
    if (!reduceMotion) LayoutAnimation.configureNext(DAY_TOGGLE_ANIMATION);
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  return { collapsedDays, toggleDay };
}
