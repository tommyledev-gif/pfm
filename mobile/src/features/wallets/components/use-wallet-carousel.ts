import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { Wallet } from "@/features/wallets/types";
import { CARD_OVERLAP, CARD_WIDTH } from "@/features/wallets/components/wallet-card-geometry";
import { nextCentre } from "@/features/wallets/components/carousel-centre";
import { useCarouselSettle } from "@/features/wallets/components/use-carousel-settle";

// Each card steps less than its own width, so every card overlaps its
// neighbour — the layout itself is a stack, not a row with gaps.
export const SNAP_INTERVAL = CARD_WIDTH - CARD_OVERLAP;
// ⚠️ Looping needs enough wallets that the copies never put the same wallet on
// screen twice. With the active card plus one neighbour each side visible,
// three distinct wallets is the floor; below it this is a plain bounded list.
const MIN_WALLETS_TO_LOOP = 3;
const LOOP_COPIES = 3;
// The pager arrows' and side-card taps' slide. Critically damped (damping =
// 2·√stiffness): no overshoot past the card, and a re-aim mid-slide keeps the
// current velocity instead of stopping and starting again.
const DRIVE_SPRING = { stiffness: 260, damping: 32, mass: 1 };

interface UseWalletCarouselOptions {
  wallets: Wallet[];
  /** Wallet to land on when the carousel first lays out; the first one otherwise. */
  initialWalletId?: string | null;
  onActiveWalletChange?: (walletId: string) => void;
}

/**
 * Scroll state for WalletCarousel (split out for the 300-line cap). Owns the
 * loop: three copies of the list end to end, re-anchored into the middle one.
 *
 * ⚠️ Everything that moves the scroll runs on the UI thread and sets
 * `scrollX` in the same frame as the native offset:
 *   - The loop re-anchor was a JS scrollTo: for a frame the offset had jumped
 *     a whole copy while the cards still read the old `scrollX`, so the
 *     transparent far copies were drawn in place: the flash on a quick switch.
 *   - Arrows and side-card taps used RN's fixed 250ms scrollTo (presses queued:
 *     stop, start, stop). They drive one spring a further press re-aims.
 */
export function useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange }: UseWalletCarouselOptions) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // The scroll offset on the UI thread: every card and pager dot reads it.
  const scrollX = useSharedValue(0);
  // The centred card in `rendered` indices (carousel-centre), which the cards'
  // paint order reads; `lastPosition` (in cards) gives the speed it needs.
  const centre = useSharedValue(0);
  const lastPosition = useSharedValue(0);
  // A programmatic slide in flight: its unwrapped position, and where it ends.
  const driving = useSharedValue(false);
  const driveX = useSharedValue(0);
  const driveGoal = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const { centreIndex, settledCentre, settle: onSettle, settleNow, cancel: cancelSettle } = useCarouselSettle();
  const didInitialScroll = useRef(false);
  // JS mirror of `driving`: while a slide runs, a tap never "opens" a card.
  const isDriving = useRef(false);
  // Read once: a host feeding the reported active wallet straight back in
  // here must not re-aim a landing that is still pending.
  const initialWalletIdRef = useRef(initialWalletId);

  const looping = wallets.length >= MIN_WALLETS_TO_LOOP;
  // The user always sits in the middle copy, so there is a full copy of
  // runway in either direction before a jump is owed.
  const rendered = looping ? Array.from({ length: LOOP_COPIES }, () => wallets).flat() : wallets;
  const loopWidth = wallets.length * SNAP_INTERVAL;
  const maxX = Math.max(0, rendered.length - 1) * SNAP_INTERVAL;
  // Farthest an arrow-driven slide may run ahead of the cards on screen.
  const driveReach = Math.max(1, wallets.length - 1) * SNAP_INTERVAL;

  // Side padding is what actually centres a card: the first and last items
  // need half a viewport of empty space beside them to reach the middle.
  const sidePadding = containerWidth > 0 ? Math.max(0, (containerWidth - CARD_WIDTH) / 2) : 0;

  // The rendered index showing wallets[walletIndex] — in the middle copy when looping.
  const renderedIndexOf = (walletIndex: number) => (looping ? wallets.length : 0) + walletIndex;

  const onDriveEnd = useLatestCallback((landed?: number) => {
    isDriving.current = false;
    if (landed !== undefined) onSettle(landed);
  });
  const onBeginDrag = useLatestCallback(() => {
    isDriving.current = false;
    cancelSettle();
  });

  // Folds an offset into the middle copy (half a copy of runway each side).
  // The copies are identical, so the jump cannot be seen — as long as the
  // cards move with it in the same frame, which `place` makes sure of.
  const wrap = (x: number) => {
    "worklet";
    if (!looping) return Math.min(maxX, Math.max(0, x));
    const half = loopWidth / 2;
    return ((((x - half) % loopWidth) + loopWidth) % loopWidth) + half;
  };

  // UI thread only: React hears about the centre when the carousel settles.
  const track = (x: number) => {
    "worklet";
    scrollX.value = x;
    const position = x / SNAP_INTERVAL;
    const next = nextCentre(position, lastPosition.value, centre.value);
    lastPosition.value = position;
    if (next !== centre.value) centre.value = next;
  };

  const place = (x: number) => {
    "worklet";
    scrollTo(scrollRef, x, 0, false);
    track(x);
  };

  const startDrive = (goal: number) => {
    "worklet";
    if (!driving.value) {
      driveX.value = scrollX.value;
      driving.value = true;
    }
    driveGoal.value = goal;
    driveX.value = withSpring(goal, DRIVE_SPRING, (finished) => {
      // A re-aim or a drag cut it short: whoever did that owns the scroll now.
      if (!finished) return;
      place(wrap(goal));
      driving.value = false;
      scheduleOnRN(onDriveEnd, centre.value);
    });
  };

  // One card along (the arrows). Pressed again mid-slide, it extends the
  // running slide's goal rather than queueing a new one.
  const driveBy = (delta: number) => {
    "worklet";
    const current = driving.value ? driveX.value : scrollX.value;
    const base = driving.value ? driveGoal.value : Math.round(scrollX.value / SNAP_INTERVAL) * SNAP_INTERVAL;
    const goal = looping ? base + delta * SNAP_INTERVAL : Math.min(maxX, Math.max(0, base + delta * SNAP_INTERVAL));
    if (Math.abs(goal - current) <= driveReach) startDrive(goal);
    // No slide started: release the JS-side hold `step` took for it.
    else if (!driving.value) scheduleOnRN(onDriveEnd);
  };

  // Straight to the card at rendered `index`, from wherever the slide is.
  const driveToCard = (index: number) => {
    "worklet";
    const current = driving.value ? driveX.value : scrollX.value;
    startDrive(current + (index * SNAP_INTERVAL - scrollX.value));
  };

  // A slide moves the scroll view itself, one frame at a time.
  useAnimatedReaction(
    () => (driving.value ? driveX.value : null),
    (x) => {
      if (x !== null) place(wrap(x));
    },
    [looping, loopWidth, maxX],
  );

  const jumpTo = (index: number) => {
    const x = index * SNAP_INTERVAL;
    scrollRef.current?.scrollTo({ x, animated: false });
    scrollX.value = x;
    lastPosition.value = index;
    centre.value = index;
    settleNow(index);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setContainerWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  // Landing has to happen without animation, or the user watches the
  // carousel scroll itself on arrival.
  const onContentSizeChange = () => {
    if (didInitialScroll.current || containerWidth === 0 || wallets.length === 0) return;
    didInitialScroll.current = true;
    const initial = Math.max(0, wallets.findIndex((w) => w.id === initialWalletIdRef.current));
    if (looping || initial > 0) jumpTo(renderedIndexOf(initial));
    onActiveWalletChange?.(wallets[initial].id);
  };

  /** One card left (-1) or right (+1) — the pager's arrows. */
  const step = (delta: 1 | -1) => {
    if (!looping && !isDriving.current) {
      const target = settledCentre.current + delta;
      if (target < 0 || target >= rendered.length) return;
    }
    isDriving.current = true;
    scheduleOnUI(driveBy, delta);
  };

  /**
   * A tap on the card at rendered `index`: the centred card opens, a side
   * card slides to the centre — the same result as swiping it over.
   *
   * ⚠️ While a slide runs, a tap never opens anything: a quick second tap on
   * the card sliding in used to "open" it (on Home, navigating away). It
   * re-aims the slide at the tapped card instead.
   */
  const pressCard = (index: number, open?: () => void) => {
    if (!isDriving.current && index === settledCentre.current) {
      open?.();
      return;
    }
    isDriving.current = true;
    scheduleOnUI(driveToCard, index);
  };

  const centredId = rendered[centreIndex]?.id;
  const centredIdRef = useRef(centredId);

  // ⚠️ The list can reorder under the user (GET /wallets sorts the default
  // first): the wallet that was centred is re-centred at its new position.
  // Declared before the ref update below so it reads the previous id.
  const walletOrder = wallets.map((w) => w.id).join(",");
  useEffect(() => {
    if (!didInitialScroll.current || wallets.length === 0) return;
    const previous = centredIdRef.current;
    if (previous && rendered[centreIndex]?.id === previous) return;
    const index = wallets.findIndex((w) => w.id === previous);
    jumpTo(renderedIndexOf(Math.max(0, index)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletOrder]);

  // Silent until the landing above has happened — before it, the centre is
  // just wherever the scroll view started, not a wallet anyone chose.
  useEffect(() => {
    centredIdRef.current = centredId;
    if (centredId && didInitialScroll.current) onActiveWalletChange?.(centredId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centredId]);

  useEffect(() => () => cancelAnimation(driveX), [driveX]);

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        // A slide sets the offset itself, frame by frame; the events its
        // scrollTo calls echo back arrive a frame late and would drag the
        // cards back to where they were.
        if (driving.value) return;
        track(event.contentOffset.x);
      },
      // A drag takes over from any slide still in flight.
      onBeginDrag: () => {
        if (driving.value) {
          cancelAnimation(driveX);
          driving.value = false;
        }
        scheduleOnRN(onBeginDrag);
      },
      // ⚠️ The wrap happens only once motion has stopped. Re-anchoring
      // mid-fling would cancel the user's own momentum. Ignored during a
      // slide: Android reports a momentum end for every touch once it
      // settles, and the slide lands (and wraps) by itself.
      onMomentumEnd: (event) => {
        if (driving.value) return;
        const x = event.contentOffset.x;
        const settled = wrap(x);
        if (Math.abs(settled - x) > 0.5) place(settled);
        scheduleOnRN(onSettle, centre.value);
      },
      // Released exactly on a card (iOS): no momentum follows, so this is the settle.
      onEndDrag: (event) => {
        if (driving.value) return;
        const position = event.contentOffset.x / SNAP_INTERVAL;
        if (Math.abs(position - Math.round(position)) < 0.01) scheduleOnRN(onSettle, centre.value);
      },
    },
    [looping, loopWidth, maxX],
  );

  return {
    scrollRef,
    scrollX,
    centre,
    scrollHandler,
    containerWidth,
    centreIndex,
    rendered,
    sidePadding,
    onLayout,
    onContentSizeChange,
    pressCard,
    step,
    looping,
  };
}
