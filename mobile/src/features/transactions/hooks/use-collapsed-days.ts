import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// One motion for a day folding or unfolding: the header's chevron turning,
// and the rows of a day being opened easing in (DayFoldRow). The Items
// editor's lines (ExpandableLine) borrow it too.
export const DAY_TOGGLE_ANIMATION_MS = 260;

// How long a folding day's rows take to shrink away (DayFoldRow).
export const DAY_FOLD_MS = 240;
// The rows leave the list this long after the fold starts: the fold itself
// plus a couple of frames, so the drop always lands on rows already at zero
// height and nothing below them moves when it happens.
const FOLD_COMMIT_MS = DAY_FOLD_MS + 40;

// How long after a day is opened its rows still count as "being revealed".
// The list mounts cells in batches a few frames apart, so this covers the
// later batches too; a row that only mounts after it (scrolled into view
// much later) simply appears, like any other row.
const REVEAL_WINDOW_MS = 400;

const EMPTY: ReadonlySet<string> = new Set();

const withKey = (set: ReadonlySet<string>, key: string) => new Set(set).add(key);
const withoutKey = (set: ReadonlySet<string>, key: string) => {
  const next = new Set(set);
  next.delete(key);
  return next;
};

interface DayFoldState {
  /** Folded: the list gets none of their rows (see buildDaySections). */
  collapsed: ReadonlySet<string>;
  /** Folding right now: their rows are still in the list, shrinking away. */
  folding: ReadonlySet<string>;
}

/**
 * Which days of the Transactions list are folded, and the toggle that folds
 * them.
 *
 * A fold has two steps. The day first goes to `foldingDays`: its header
 * already reads as folded, but its rows stay in the list and shrink to
 * nothing (DayFoldRow). Only once that has played does it move to
 * `collapsedDays`, whose rows are dropped from the list. Dropping them at
 * once is what made folding invisible: the rows were gone in the very frame
 * of the tap, so there was nothing left to animate.
 *
 * Unfolding drops nothing: the rows come back into the list right away, and
 * `isRevealing` is how each one, mounting, knows to grow in rather than pop.
 * Tapping a day mid-fold cancels the fold, and its rows grow back.
 *
 * `toggleDay(day, false)` opens a folded day with its rows at full height at
 * once — for a jump to one of them (useFocusTransaction), which scrolls in
 * the next frame and needs every row above the target at its real height.
 */
export function useCollapsedDays() {
  const reduceMotion = useReduceMotion();
  const [days, setDays] = useState<DayFoldState>({ collapsed: EMPTY, folding: EMPTY });
  // Read during render by rows that are mounting, never rendered from — a ref
  // so recording it costs no extra render.
  const expandedAt = useRef(new Map<string, number>());
  const foldTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const toggleDay = useCallback(
    (dayKey: string, animate = true) => {
      setDays((prev) => {
        if (prev.collapsed.has(dayKey)) {
          // Idempotent, so a StrictMode double-invoke of this updater is harmless.
          if (animate) expandedAt.current.set(dayKey, Date.now());
          return { ...prev, collapsed: withoutKey(prev.collapsed, dayKey) };
        }
        if (prev.folding.has(dayKey)) return { ...prev, folding: withoutKey(prev.folding, dayKey) };
        // Reduce Motion: nothing to watch shrink, so fold in one step.
        if (reduceMotion) return { ...prev, collapsed: withKey(prev.collapsed, dayKey) };
        return { ...prev, folding: withKey(prev.folding, dayKey) };
      });
    },
    [reduceMotion],
  );

  // One timer per folding day, started and cancelled here rather than inside
  // the updater above (updaters must stay pure).
  useEffect(() => {
    const timers = foldTimers.current;
    for (const [dayKey, timer] of timers) {
      if (days.folding.has(dayKey)) continue;
      clearTimeout(timer);
      timers.delete(dayKey);
    }
    for (const dayKey of days.folding) {
      if (timers.has(dayKey)) continue;
      const timer = setTimeout(() => {
        timers.delete(dayKey);
        setDays((prev) =>
          prev.folding.has(dayKey)
            ? { collapsed: withKey(prev.collapsed, dayKey), folding: withoutKey(prev.folding, dayKey) }
            : prev,
        );
      }, FOLD_COMMIT_MS);
      timers.set(dayKey, timer);
    }
  }, [days.folding]);

  useEffect(() => {
    const timers = foldTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const isRevealing = useCallback(
    (dayKey: string) => Date.now() - (expandedAt.current.get(dayKey) ?? -Infinity) < REVEAL_WINDOW_MS,
    [],
  );

  // Folded or on the way there: what the header shows, and what a jump to a
  // row has to open first (useFocusTransaction).
  const closedDays = useMemo(() => new Set([...days.collapsed, ...days.folding]), [days]);

  return {
    collapsedDays: days.collapsed,
    foldingDays: days.folding,
    closedDays,
    toggleDay,
    isRevealing,
    reduceMotion,
  };
}
