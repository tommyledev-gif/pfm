import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useLatestCallback } from "@/lib/use-latest-callback";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { Wallet } from "@/features/wallets/types";
import { CARD_OVERLAP, CARD_WIDTH } from "@/features/wallets/components/WalletStackCard";

// Each card steps less than its own width, so every card overlaps its
// neighbour — the layout itself is a stack, not a row with gaps.
export const SNAP_INTERVAL = CARD_WIDTH - CARD_OVERLAP;
// ⚠️ Looping needs enough wallets that the copies never put the same wallet on
// screen twice. With the active card plus one neighbour each side visible,
// three distinct wallets is the floor; below it this is a plain bounded list.
const MIN_WALLETS_TO_LOOP = 3;
const LOOP_COPIES = 3;
// Longest a tap-started slide may hold the paint order before it is released
// anyway — RN's own smooth scroll runs 250ms; momentum-end normally releases
// it sooner. Only a safety net for a platform that never reports the end.
const TAP_SCROLL_SETTLE_MS = 700;

interface UseWalletCarouselOptions {
  wallets: Wallet[];
  /** Wallet to land on when the carousel first lays out; the first one otherwise. */
  initialWalletId?: string | null;
  onActiveWalletChange?: (walletId: string) => void;
}

/**
 * Scroll state for WalletCarousel — split out of the component to keep it
 * under the 300-line cap. Owns the loop: three copies of the list laid end
 * to end, the user always re-anchored into the middle one once motion stops.
 */
export function useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange }: UseWalletCarouselOptions) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // The scroll offset on the UI thread: every card and pager dot reads it.
  const scrollX = useSharedValue(0);
  // The nearest card as last reported to JS, so the handler only calls over on a change.
  const lastIndex = useSharedValue(-1);
  const [containerWidth, setContainerWidth] = useState(0);
  // Which card is currently centred, in `rendered` indices. Orders the
  // overlapping cards — the centred one has to paint ON TOP of both its
  // neighbours, and paint order in React Native is render order, which would
  // otherwise put every card to the right over the active one.
  const [centreIndex, setCentreIndex] = useState(0);
  const didInitialScroll = useRef(false);
  const reduceMotion = useReduceMotion();
  // Set while a tap-started slide is in flight — see scrollToCard.
  const tapTarget = useRef<number | null>(null);
  const tapSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arrow presses that arrived during a slide, as a signed count (+1 next,
  // -1 previous) — see step.
  const pendingSteps = useRef(0);

  const releaseTapTarget = () => {
    tapTarget.current = null;
    if (tapSettleTimer.current) clearTimeout(tapSettleTimer.current);
    tapSettleTimer.current = null;
  };
  useEffect(() => releaseTapTarget, []);
  // Read once: the landing target is where the carousel opens, and a host
  // that feeds the reported active wallet straight back in here must not
  // re-aim a landing that is still pending.
  const initialWalletIdRef = useRef(initialWalletId);

  const looping = wallets.length >= MIN_WALLETS_TO_LOOP;
  // The user always sits in the middle copy, so there is a full copy of
  // runway in either direction before a jump is owed.
  const rendered = looping ? Array.from({ length: LOOP_COPIES }, () => wallets).flat() : wallets;
  const loopWidth = wallets.length * SNAP_INTERVAL;

  // Side padding is what actually centres a card: the first and last items
  // need half a viewport of empty space beside them to reach the middle.
  const sidePadding = containerWidth > 0 ? Math.max(0, (containerWidth - CARD_WIDTH) / 2) : 0;

  // The rendered index showing wallets[walletIndex] — in the middle copy when looping.
  const renderedIndexOf = (walletIndex: number) => (looping ? wallets.length : 0) + walletIndex;

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: false });
    setCentreIndex(index);
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

  // Called from the UI-thread scroll handler only when the nearest card
  // changes, once per swipe, not once per frame. The cards' own motion and
  // paint order never wait on this (wallet-carousel-motion); it only keeps
  // the pager arrows, taps and the reported active wallet in step.
  const onScrollIndex = (next: number) => {
    if (tapTarget.current !== null) return;
    setCentreIndex((prev) => (prev === next ? prev : next));
  };

  // ⚠️ The wrap happens only once motion has stopped. Re-anchoring mid-fling
  // would cancel the user's own momentum and read as the carousel snatching
  // the card back.
  const onMomentumEnd = (x: number) => {
    let landed = false;
    if (tapTarget.current !== null) {
      // ⚠️ A tap is itself a touch on the scroll view, and Android's
      // ScrollView reports a momentum end for every touch once it settles —
      // often before the tap's own slide has even started. Wrapping on that
      // one re-anchored the carousel under a slide that was about to start,
      // which then set off from a different copy and ran backwards through
      // several cards. Only the slide's own end, at the target, releases the
      // hold and may wrap.
      if (Math.abs(x - tapTarget.current * SNAP_INTERVAL) > 1) return;
      releaseTapTarget();
      landed = true;
    }
    let settled = x;
    if (looping && (x < loopWidth / 2 || x > loopWidth * 1.5)) {
      settled = x < loopWidth / 2 ? x + loopWidth : x - loopWidth;
      scrollRef.current?.scrollTo({ x: settled, animated: false });
      setCentreIndex(Math.round(settled / SNAP_INTERVAL));
    }
    if (landed) runPendingStep(Math.round(settled / SNAP_INTERVAL));
  };

  // The middle-copy index showing the same wallet as rendered `index`.
  const anchored = (index: number) => (looping ? wallets.length + (index % wallets.length) : index);

  /**
   * Brings the card at rendered `index` to the centre — what tapping a card
   * peeking at the side does, the same result as swiping it over. The card
   * slides straight to the middle from where it sits: it was tapped, so it is
   * on screen and inside the rendered copies, and onMomentumEnd re-anchors
   * into the middle copy once the slide lands, exactly as after a fling.
   *
   * ⚠️ The tapped card counts as centred at once, and that is then held,
   * onScrollIndex ignored, until the slide lands: a second tap on it mid-slide
   * must not "open" it (see pressCard). Paint order is not part of this; it
   * follows the scroll on the UI thread (wallet-carousel-motion).
   */
  const scrollToCard = (index: number) => {
    if (index === centreIndex) return;
    releaseTapTarget();
    // No slide means no momentum end to wrap on, so land in the middle copy
    // directly — otherwise repeated arrow presses walk off the end of the copies.
    if (reduceMotion) {
      jumpTo(anchored(index));
      return;
    }
    tapTarget.current = index;
    tapSettleTimer.current = setTimeout(() => {
      pendingSteps.current = 0;
      releaseTapTarget();
    }, TAP_SCROLL_SETTLE_MS);
    setCentreIndex(index);
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
  };

  /**
   * One card left (-1) or right (+1) — the pager's arrows.
   *
   * ⚠️ A press while a slide is running is queued and run when that slide
   * lands, one card at a time. Re-aiming the running slide two cards out
   * would put the far card on top straight away, and it would pass, half
   * transparent, over the card crossing the centre.
   */
  const step = (delta: 1 | -1) => {
    if (tapTarget.current !== null) {
      const limit = Math.max(1, wallets.length - 1);
      pendingSteps.current = Math.max(-limit, Math.min(limit, pendingSteps.current + delta));
      return;
    }
    const target = centreIndex + delta;
    if (target >= 0 && target < rendered.length) scrollToCard(target);
  };

  const runPendingStep = (from: number) => {
    const queued = pendingSteps.current;
    if (queued === 0) return;
    const delta = Math.sign(queued);
    pendingSteps.current = queued - delta;
    if (from + delta >= 0 && from + delta < rendered.length) scrollToCard(from + delta);
    else pendingSteps.current = 0;
  };

  /**
   * A tap on the card at rendered `index`: the centred card opens, a side
   * card slides to the centre.
   *
   * ⚠️ While a tap-started slide is still running, the card sliding in
   * already counts as centred — so a quick second tap on it (one tap to bring
   * it over, the next landing before it arrived) "opened" it, which on Home
   * navigates away. Mid-slide, a tap on that same card is the same request
   * again and is ignored; a tap on another card re-aims the slide.
   */
  const pressCard = (index: number, open?: () => void) => {
    if (tapTarget.current !== null) {
      pendingSteps.current = 0;
      if (index !== tapTarget.current) scrollToCard(index);
      return;
    }
    if (index === centreIndex) open?.();
    else scrollToCard(index);
  };

  const centredId = rendered[centreIndex]?.id;
  const centredIdRef = useRef(centredId);

  // ⚠️ The list can reorder under the user — GET /wallets sorts the default
  // wallet first, so setting a new default moves it to the front. The scroll
  // offset would stay put and a different wallet would slide under the
  // centre; instead the wallet that was centred is re-centred at its new
  // position. Declared before the ref update below so it still reads the
  // previously centred id.
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

  // A drag takes over from any tap-started slide still in flight, and drops
  // arrow presses still queued behind it.
  const onBeginDrag = () => {
    pendingSteps.current = 0;
    releaseTapTarget();
  };

  // Stable identities for the worklet below, always running the latest code.
  const reportIndex = useLatestCallback(onScrollIndex);
  const reportMomentumEnd = useLatestCallback(onMomentumEnd);
  const reportBeginDrag = useLatestCallback(onBeginDrag);
  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollX.value = event.contentOffset.x;
        const index = Math.round(event.contentOffset.x / SNAP_INTERVAL);
        if (index !== lastIndex.value) {
          lastIndex.value = index;
          scheduleOnRN(reportIndex, index);
        }
      },
      onBeginDrag: () => {
        scheduleOnRN(reportBeginDrag);
      },
      onMomentumEnd: (event) => {
        scheduleOnRN(reportMomentumEnd, event.contentOffset.x);
      },
    },
    [reportIndex, reportMomentumEnd, reportBeginDrag],
  );

  return {
    scrollRef,
    scrollX,
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
