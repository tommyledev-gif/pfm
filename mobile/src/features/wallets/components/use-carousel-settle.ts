import { useCallback, useEffect, useRef, useState } from "react";

import { useLatestCallback } from "@/lib/use-latest-callback";

// How long the carousel has to stay settled before the centred wallet
// reaches React. Every report re-renders the host — on the Wallets screen it
// swaps the transactions list under the cards — and a re-render landing
// while the next swipe was under way stalled it. Swiping on cancels it.
const SETTLE_IDLE_MS = 180;

/**
 * The wallet carousel's centred card on the JS side (split out of
 * useWalletCarousel for the 300-line cap). It changes only when the carousel
 * settles, never card by card during a swipe: `settledCentre` has it at once
 * for taps and arrows, `centreIndex` (which re-renders) after SETTLE_IDLE_MS.
 */
export function useCarouselSettle() {
  const [centreIndex, setCentreIndex] = useState(0);
  const settledCentre = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /** Settled on rendered card `next` (from the UI thread): report it once idle. */
  const settle = useLatestCallback((next: number) => {
    settledCentre.current = next;
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      setCentreIndex(next);
    }, SETTLE_IDLE_MS);
  });

  /** A jump the code made itself (landing, reorder): reported straight away. */
  const settleNow = useCallback(
    (index: number) => {
      cancel();
      settledCentre.current = index;
      setCentreIndex(index);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { centreIndex, settledCentre, settle, settleNow, cancel };
}
