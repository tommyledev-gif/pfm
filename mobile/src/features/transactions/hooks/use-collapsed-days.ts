import { useState } from "react";

// One motion for a day folding or unfolding: its rows easing shut (see
// CollapsibleRow), and every later day sliding to its new place. Shared with
// the header's chevron so the two move as one.
export const DAY_TOGGLE_ANIMATION_MS = 260;

/**
 * Which days of the Transactions list are folded, and the toggle that folds
 * them. The motion itself lives in CollapsibleRow and the day header, each
 * honouring the OS's reduced-motion setting.
 */
export function useCollapsedDays() {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  return { collapsedDays, toggleDay };
}
