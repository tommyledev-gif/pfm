import { useCallback, useRef, useState } from "react";

// One motion for a day folding or unfolding: the header's chevron turning,
// and the rows of a day being opened easing in (ExpandRevealRow).
export const DAY_TOGGLE_ANIMATION_MS = 260;

// How long after a day is opened its rows still count as "being revealed".
// The list mounts cells in batches a few frames apart, so this covers the
// later batches too; a row that only mounts after it (scrolled into view
// much later) simply appears, like any other row.
const REVEAL_WINDOW_MS = 400;

/**
 * Which days of the Transactions list are folded, and the toggle that folds
 * them. A folded day's rows are dropped from the list entirely (see
 * buildDaySections), so `isRevealing` is how a row mounting back in can tell
 * it is part of an unfold and should ease in rather than pop.
 */
export function useCollapsedDays() {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  // Read during render by rows that are mounting, never rendered from — a ref
  // so recording it costs no extra render.
  const expandedAt = useRef(new Map<string, number>());

  const toggleDay = useCallback((dayKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
        // Idempotent, so a StrictMode double-invoke of this updater is harmless.
        expandedAt.current.set(dayKey, Date.now());
      } else {
        next.add(dayKey);
      }
      return next;
    });
  }, []);

  const isRevealing = useCallback(
    (dayKey: string) => Date.now() - (expandedAt.current.get(dayKey) ?? -Infinity) < REVEAL_WINDOW_MS,
    [],
  );

  return { collapsedDays, toggleDay, isRevealing };
}
