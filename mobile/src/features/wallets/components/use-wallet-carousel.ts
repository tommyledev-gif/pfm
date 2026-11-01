import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { Wallet } from "@/features/wallets/types";
import { CARD_WIDTH, SNAP_INTERVAL } from "@/features/wallets/components/wallet-card-geometry";
import { RUNWAY_DECKS, useCarouselScroll } from "@/features/wallets/components/use-carousel-scroll";
import { useCarouselSettle } from "@/features/wallets/components/use-carousel-settle";

export { SNAP_INTERVAL } from "@/features/wallets/components/wallet-card-geometry";

// ⚠️ Looping needs enough wallets that the copies never put the same wallet on
// screen twice. With the active card plus one neighbour each side visible,
// three distinct wallets is the floor; below it this is a plain bounded list.
const MIN_WALLETS_TO_LOOP = 3;
// Cards the looping deck draws: one per wallet from four up. Three wallets
// get two of each: mid-swipe four places show, and one of them would need to
// be in two places at once.
const MIN_DECK_CARDS = 4;

interface UseWalletCarouselOptions {
  wallets: Wallet[];
  /** Wallet to land on when the carousel first lays out; the first one otherwise. */
  initialWalletId?: string | null;
  onActiveWalletChange?: (walletId: string) => void;
}

/**
 * State for WalletCarousel (split out for the 300-line cap): the deck, the
 * wallet in the middle, the landing, the arrows and taps. The cards' motion
 * and the drag live in useCarouselScroll.
 *
 * Card positions run on without end when looping (card n at n·SNAP_INTERVAL,
 * wallet n mod count); `walletAt` reads the wallet at one.
 */
export function useWalletCarousel({ wallets, initialWalletId, onActiveWalletChange }: UseWalletCarouselOptions) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [containerWidth, setContainerWidth] = useState(0);
  const { centreIndex, settledCentre, settle: onSettle, settleNow, cancel: cancelSettle } = useCarouselSettle();
  const didInitialScroll = useRef(false);
  // JS mirror of a slide in flight: while one runs, a tap never "opens" a card.
  const isDriving = useRef(false);
  // Read once: a host feeding the reported active wallet straight back in
  // here must not re-aim a landing that is still pending.
  const initialWalletIdRef = useRef(initialWalletId);

  const count = wallets.length;
  const looping = count >= MIN_WALLETS_TO_LOOP;
  const copies = looping ? Math.ceil(MIN_DECK_CARDS / count) : 1;
  const deck = copies > 1 ? Array.from({ length: copies }, () => wallets).flat() : wallets;
  // A card sits at whichever of its positions is nearest (slotOf): the deck
  // repeats every `loopCount` places. 0: a bounded list, card n at place n.
  const loopCount = looping ? deck.length : 0;
  const maxSlot = Math.max(0, count - 1);
  const nativeSlots = looping ? RUNWAY_DECKS * deck.length : count;

  // Side padding is what actually centres a card: the first and last items
  // need half a viewport of empty space beside them to reach the middle.
  const sidePadding = containerWidth > 0 ? Math.max(0, (containerWidth - CARD_WIDTH) / 2) : 0;
  const contentWidth = sidePadding * 2 + Math.max(0, nativeSlots - 1) * SNAP_INTERVAL + CARD_WIDTH;

  /** The wallet at card position `slot` (any loop round). */
  const walletAt = (slot: number): Wallet | undefined =>
    wallets[looping ? ((slot % count) + count) % count : slot];

  const onDriveEnd = useLatestCallback((landed?: number) => {
    isDriving.current = false;
    if (landed !== undefined) onSettle(landed);
  });
  const onBeginDrag = useLatestCallback(() => {
    isDriving.current = false;
    cancelSettle();
  });
  const onRelease = useLatestCallback(() => {
    isDriving.current = true;
  });

  const scroll = useCarouselScroll({
    scrollRef,
    looping,
    deckSize: deck.length,
    maxSlot,
    driveReach: Math.max(1, count - 1) * SNAP_INTERVAL,
    onDriveEnd,
    onBeginDrag,
    onRelease,
  });

  const jumpTo = (walletIndex: number) => {
    scroll.jumpTo(walletIndex);
    settleNow(walletIndex);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setContainerWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  };

  // Landing has to happen without animation, or the user watches the
  // carousel scroll itself on arrival.
  const onContentSizeChange = () => {
    if (didInitialScroll.current || containerWidth === 0 || count === 0) return;
    didInitialScroll.current = true;
    const initial = Math.max(0, wallets.findIndex((w) => w.id === initialWalletIdRef.current));
    jumpTo(initial);
    onActiveWalletChange?.(wallets[initial].id);
  };

  /** One card left (-1) or right (+1) — the pager's arrows. */
  const step = (delta: 1 | -1) => {
    if (!looping && !isDriving.current) {
      const target = settledCentre.current + delta;
      if (target < 0 || target > maxSlot) return;
    }
    isDriving.current = true;
    scheduleOnUI(scroll.driveBy, delta);
  };

  /**
   * A tap on the card at position `slot`: the centred card opens, a side
   * card slides to the centre — the same result as swiping it over.
   *
   * ⚠️ While a slide runs, a tap never opens anything: a quick second tap on
   * the card sliding in used to "open" it (on Home, navigating away). It
   * re-aims the slide at the tapped card instead.
   */
  const pressCard = (slot: number, open?: () => void) => {
    if (!isDriving.current && slot === settledCentre.current) {
      open?.();
      return;
    }
    isDriving.current = true;
    scheduleOnUI(scroll.driveToCard, slot);
  };

  const centredId = walletAt(centreIndex)?.id;
  const centredIdRef = useRef(centredId);

  // ⚠️ The list can reorder under the user (GET /wallets sorts the default
  // first), or grow and shrink, which changes the deck: the wallet that was
  // centred is re-centred where it now is. Declared before the ref update
  // below so it reads the previous id.
  const walletOrder = wallets.map((w) => w.id).join(",");
  useEffect(() => {
    if (!didInitialScroll.current || count === 0) return;
    jumpTo(Math.max(0, wallets.findIndex((w) => w.id === centredIdRef.current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletOrder]);

  // Silent until the landing above has happened — before it, the centre is
  // just wherever the scroll view started, not a wallet anyone chose.
  useEffect(() => {
    centredIdRef.current = centredId;
    if (centredId && didInitialScroll.current) onActiveWalletChange?.(centredId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centredId]);

  // prettier-ignore
  return {
    scrollRef, scrollX: scroll.scrollX, anchor: scroll.anchor, centre: scroll.centre,
    scrollHandler: scroll.scrollHandler, containerWidth, centreIndex, deck, loopCount, contentWidth,
    walletAt, onLayout, onContentSizeChange, pressCard, step, looping,
  };
}
