import { useEffect } from "react";
import Animated, {
  AnimatedRef,
  Easing,
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { FLICK_SPEED, nextCentre, releaseTarget } from "@/features/wallets/components/carousel-centre";
import { SNAP_INTERVAL } from "@/features/wallets/components/wallet-card-geometry";

// The native scroll space: this many decks end to end, kept in the middle one.
export const RUNWAY_DECKS = 5;
const MIDDLE_DECK = 2;
// The pager arrows' and side-card taps' slide. Critically damped (damping =
// 2·√stiffness): no overshoot past the card, and a re-aim mid-slide keeps the
// current velocity instead of stopping and starting again.
const DRIVE_SPRING = { stiffness: 260, damping: 32, mass: 1 };
// ⚠️ A let-go swipe is finished here, never by the native fling: 300ms for
// the last few px, up to 480ms for a whole card, however hard the flick.
// Android's snap boosted the flick, threw the card across in ~100ms and
// stopped it dead on the card (or past it and back): the paint order, which
// waits for a commit, could not keep up — the flash and shake on a quick swipe.
const RELEASE_MIN_MS = 300;
const RELEASE_MAX_MS = 480;
const FLICK_EASING = Easing.bezier(0.25, 1, 0.5, 1);
// Let go nearly still: starts gently instead of jumping to speed.
const SETTLE_EASING = Easing.bezier(0.45, 0, 0.2, 1);

const mod = (n: number, m: number) => {
  "worklet";
  return ((n % m) + m) % m;
};

interface UseCarouselScrollOptions {
  scrollRef: AnimatedRef<Animated.ScrollView>;
  looping: boolean;
  /** Cards in the deck: the cards repeat every this many places when looping. */
  deckSize: number;
  /** The last card position of a bounded (non-looping) list. */
  maxSlot: number;
  /** Farthest an arrow-driven slide may run ahead of the cards on screen, px. */
  driveReach: number;
  /** A slide (release, arrow, tap) landed on card position `landed`; none if it never started. */
  onDriveEnd: (landed?: number) => void;
  /** A slide set off (or was re-aimed) toward card position `goal`. */
  onDriveStart: (goal: number) => void;
  onBeginDrag: () => void;
  /** A let-go swipe is sliding on by itself. */
  onRelease: () => void;
}

/**
 * The wallet carousel's UI-thread half (split out of useWalletCarousel for
 * the 300-line cap): the cards' position, the drag, and every slide.
 *
 * ⚠️ Two positions. `scrollX` is where the cards are, in px along an endless
 * line (card n at n·SNAP_INTERVAL): it only ever moves smoothly. The native
 * offset is the ScrollView's, which only supplies the drag; `anchor` maps one
 * to the other (scrollX = native + anchor). Looping, the native offset is
 * moved back into the middle deck of its runway by whole decks, at every
 * landing and every drag start, with `anchor` moved the other way: the cards
 * never see it. It used to be the cards' own position, folded only once a
 * fling had stopped: a run of quick swipes reached the end of the scroll
 * space, where there were no cards, and they all appeared when it settled.
 *
 * Everything that moves the scroll runs on the UI thread, in the frame it
 * happens.
 */
export function useCarouselScroll({
  scrollRef,
  looping,
  deckSize,
  maxSlot,
  driveReach,
  onDriveEnd,
  onDriveStart,
  onBeginDrag,
  onRelease,
}: UseCarouselScrollOptions) {
  // Where the cards are (above): every card and pager dot reads it.
  const scrollX = useSharedValue(0);
  const anchor = useSharedValue(0);
  // The centred card in card positions (carousel-centre), which the cards'
  // paint order reads; `lastPosition` gives the speed it needs, `heading`
  // the way the last real move went.
  const centre = useSharedValue(0);
  const lastPosition = useSharedValue(0);
  const heading = useSharedValue(0);
  // A finger on the scroll: only then does the native offset move the cards.
  const dragging = useSharedValue(false);
  // A slide in flight: where it is and where it ends.
  const driving = useSharedValue(false);
  const driveX = useSharedValue(0);
  const driveGoal = useSharedValue(0);
  const deckWidth = deckSize * SNAP_INTERVAL;

  const clampSlot = (slot: number) => {
    "worklet";
    return looping ? slot : Math.min(maxSlot, Math.max(0, slot));
  };

  // A native offset as a card position. An event from before a re-centre
  // (a scrollTo lands a frame after it is asked for) is whole decks off:
  // put back, since no real move between two events comes near that.
  const fromNative = (native: number) => {
    "worklet";
    const x = native + anchor.value;
    return looping ? x - Math.round((x - scrollX.value) / deckWidth) * deckWidth : x;
  };

  const track = (x: number) => {
    "worklet";
    scrollX.value = x;
    const position = x / SNAP_INTERVAL;
    const step = position - lastPosition.value;
    if (Math.abs(step) > 0.002) heading.value = step > 0 ? 1 : -1;
    const next = nextCentre(position, lastPosition.value, centre.value);
    lastPosition.value = position;
    if (next !== centre.value) centre.value = next;
  };

  const place = (x: number) => {
    "worklet";
    scrollTo(scrollRef, x - anchor.value, 0, false);
    track(x);
  };

  // The native offset back into the middle deck, the anchor moved with it.
  const recentre = () => {
    "worklet";
    if (!looping) return;
    const native = scrollX.value - anchor.value;
    const middle = MIDDLE_DECK * deckWidth;
    const centred = mod(native - middle, deckWidth) + middle;
    if (Math.abs(centred - native) < 0.5) return;
    anchor.value += native - centred;
    scrollTo(scrollRef, centred, 0, false);
  };

  const land = () => {
    "worklet";
    place(driveGoal.value);
    driving.value = false;
    recentre();
    scheduleOnRN(onDriveEnd, centre.value);
  };

  const beginDrive = (goal: number) => {
    "worklet";
    if (!driving.value) {
      driveX.value = scrollX.value;
      driving.value = true;
    }
    driveGoal.value = goal;
  };

  const startDrive = (goal: number) => {
    "worklet";
    beginDrive(goal);
    scheduleOnRN(onDriveStart, goal / SNAP_INTERVAL);
    // A re-aim or a drag cut it short: whoever did that owns the scroll now.
    driveX.value = withSpring(goal, DRIVE_SPRING, (finished) => {
      if (finished) land();
    });
  };

  // A let-go swipe, on to the card at `slot` in RELEASE_MIN_MS–RELEASE_MAX_MS.
  const release = (slot: number, flick: boolean) => {
    "worklet";
    const goal = clampSlot(slot) * SNAP_INTERVAL;
    const distance = Math.abs(goal - scrollX.value) / SNAP_INTERVAL;
    beginDrive(goal);
    if (distance < 0.002) {
      land();
      return;
    }
    const duration = RELEASE_MIN_MS + (RELEASE_MAX_MS - RELEASE_MIN_MS) * Math.min(1, distance);
    driveX.value = withTiming(goal, { duration, easing: flick ? FLICK_EASING : SETTLE_EASING }, (finished) => {
      if (finished) land();
    });
    scheduleOnRN(onRelease);
    scheduleOnRN(onDriveStart, goal / SNAP_INTERVAL);
  };

  /** One card along (the arrows). Pressed again mid-slide, it extends the running slide's goal. */
  const driveBy = (delta: number) => {
    "worklet";
    const current = driving.value ? driveX.value : scrollX.value;
    const base = driving.value ? driveGoal.value : Math.round(scrollX.value / SNAP_INTERVAL) * SNAP_INTERVAL;
    const goal = clampSlot(Math.round(base / SNAP_INTERVAL) + delta) * SNAP_INTERVAL;
    if (goal !== base && Math.abs(goal - current) <= driveReach) startDrive(goal);
    // No slide started: release the JS-side hold the arrow took for it.
    else if (!driving.value) scheduleOnRN(onDriveEnd);
  };

  /** Straight to the card at position `slot`, from wherever the slide is. */
  const driveToCard = (slot: number) => {
    "worklet";
    startDrive(clampSlot(slot) * SNAP_INTERVAL);
  };

  // A slide moves the cards and the scroll view, one frame at a time.
  useAnimatedReaction(
    () => (driving.value ? driveX.value : null),
    (x) => {
      if (x !== null) place(x);
    },
    [],
  );

  /** Straight to wallet `walletIndex` (JS thread), at its position in the first round. */
  const jumpTo = (walletIndex: number) => {
    cancelAnimation(driveX);
    driving.value = false;
    const native = (looping ? MIDDLE_DECK * deckSize + walletIndex : walletIndex) * SNAP_INTERVAL;
    scrollRef.current?.scrollTo({ x: native, animated: false });
    anchor.value = walletIndex * SNAP_INTERVAL - native;
    scrollX.value = walletIndex * SNAP_INTERVAL;
    lastPosition.value = walletIndex;
    centre.value = walletIndex;
  };

  useEffect(() => () => cancelAnimation(driveX), [driveX]);

  const scrollHandler = useAnimatedScrollHandler(
    {
      // ⚠️ Only a drag moves the cards from here. A slide sets the offset
      // itself, frame by frame, and the events its scrollTo calls echo back
      // arrive a frame late: they would drag the cards back to where they
      // were. Whatever the native fling still does after a release is the
      // native offset's business alone (`anchor` is re-taken at the next drag).
      onScroll: (event) => {
        if (driving.value || !dragging.value) return;
        track(fromNative(event.contentOffset.x));
      },
      // A drag takes over from any slide still in flight, from where the
      // cards are, with a full deck of runway either side.
      onBeginDrag: (event) => {
        if (driving.value) {
          cancelAnimation(driveX);
          driving.value = false;
        }
        if (looping) {
          anchor.value = scrollX.value - event.contentOffset.x;
          recentre();
        }
        dragging.value = true;
        scheduleOnRN(onBeginDrag);
      },
      onEndDrag: (event) => {
        dragging.value = false;
        if (driving.value) return;
        const speed = Math.abs(event.velocity?.x ?? 0);
        release(releaseTarget(scrollX.value / SNAP_INTERVAL, heading.value, speed), speed >= FLICK_SPEED);
      },
      // Only when the release above never ran (a drag Android cancelled):
      // a slide's own landing settles everything else.
      onMomentumEnd: () => {
        dragging.value = false;
        if (driving.value) return;
        release(Math.round(scrollX.value / SNAP_INTERVAL), false);
      },
    },
    [looping, deckWidth, maxSlot],
  );

  return { scrollX, anchor, centre, scrollHandler, driveBy, driveToCard, jumpTo };
}
