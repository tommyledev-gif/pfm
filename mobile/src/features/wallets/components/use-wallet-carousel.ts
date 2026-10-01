import { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

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
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
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

  // ⚠️ Attached as the listener of the native-driven scroll event, not as a
  // second onScroll: the animation stays on the native driver, and this only
  // re-renders when the centred card actually changes — once per swipe, not
  // once per frame.
  const onScrollFrame = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (tapTarget.current !== null) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setCentreIndex((prev) => (prev === next ? prev : next));
  };

  // ⚠️ The wrap happens only once motion has stopped. Re-anchoring mid-fling
  // would cancel the user's own momentum and read as the carousel snatching
  // the card back.
  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
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
    }
    if (!looping) return;
    if (x < loopWidth / 2) {
      scrollRef.current?.scrollTo({ x: x + loopWidth, animated: false });
      setCentreIndex(Math.round((x + loopWidth) / SNAP_INTERVAL));
    } else if (x > loopWidth * 1.5) {
      scrollRef.current?.scrollTo({ x: x - loopWidth, animated: false });
      setCentreIndex(Math.round((x - loopWidth) / SNAP_INTERVAL));
    }
  };

  /**
   * Brings the card at rendered `index` to the centre — what tapping a card
   * peeking at the side does, the same result as swiping it over. The card
   * slides straight to the middle from where it sits: it was tapped, so it is
   * on screen and inside the rendered copies, and onMomentumEnd re-anchors
   * into the middle copy once the slide lands, exactly as after a fling.
   *
   * ⚠️ The tapped card is put on top at once, and the paint order is then
   * held there — onScrollFrame is ignored — until the slide lands. Paint
   * order is the one part of this carousel driven from JS, and letting it
   * follow the slide frame by frame meant a JS re-render had to land mid-
   * slide: on a slow device it landed late, leaving the previous card (by
   * then half transparent) painted over the new centre and dimming it.
   */
  const scrollToCard = (index: number) => {
    if (index === centreIndex) return;
    releaseTapTarget();
    tapTarget.current = index;
    tapSettleTimer.current = setTimeout(releaseTapTarget, TAP_SCROLL_SETTLE_MS);
    setCentreIndex(index);
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: !reduceMotion });
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

  return {
    scrollRef,
    scrollX,
    containerWidth,
    centreIndex,
    rendered,
    sidePadding,
    onLayout,
    onContentSizeChange,
    onScrollFrame,
    onMomentumEnd,
    pressCard,
    // A drag takes over from any tap-started slide still in flight.
    onScrollBeginDrag: releaseTapTarget,
  };
}
