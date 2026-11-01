// Which card the wallet carousel counts as centred, worked out on the UI
// thread from the scroll position (in cards). It sets the cards' paint order
// (wallet-carousel-motion) and, once the carousel settles, the active wallet.

// At rest: how far past the halfway mark the centred card changes. Without
// it a finger resting at the halfway mark flipped the centred card — so both
// cards' paint order and shadow — on every pixel of jitter: the two cards
// shook. Inside the swap's clear window (0.3–0.7, wallet-carousel-motion).
const CENTRE_HYSTERESIS = 0.08;
// Moving faster than this (cards per scroll event, about one a frame)...
const FAST_CARDS_PER_EVENT = 0.03;
// ...the centred card changes as soon as the incoming card is clear of it.
//
// ⚠️ Paint order (zIndex, elevation) does not move in the same frame as the
// cards: transform and opacity take Reanimated's synchronous path on Android
// (ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS), paint order waits for a commit. A
// flip at 0.58 left 0.12 of a card before the two overlap again, which a
// quick flick covers in under a frame: the incoming card showed on the wrong
// side of the centre one for a few frames, a flash. Flipped at 0.35 there is
// most of the clear window to spare. Anywhere inside it the flip itself
// cannot be seen: the two swapping cards do not overlap there, and each of
// them stays above its own outer neighbour either way.
const FAST_FLIP_AT = 0.35;

/**
 * The centred card for scroll `position`, given the `previous` position and
 * the current `centre`. Fast moves flip early, in the direction of travel
 * only (a flip back the other way would be immediate); slow ones flip past
 * the halfway mark with hysteresis.
 */
export function nextCentre(position: number, previous: number, centre: number): number {
  "worklet";
  const step = position - previous;
  if (step >= FAST_CARDS_PER_EVENT) {
    const ahead = Math.floor(position + 1 - FAST_FLIP_AT);
    if (ahead > centre) return ahead;
  } else if (step <= -FAST_CARDS_PER_EVENT) {
    const behind = Math.ceil(position - 1 + FAST_FLIP_AT);
    if (behind < centre) return behind;
  }
  if (Math.abs(position - centre) < 0.5 + CENTRE_HYSTERESIS) return centre;
  return Math.round(position);
}

// A release faster than this (dp per ms; the scroll's end-drag velocity) is a
// flick: on to the next card the way it was going, however little it moved.
export const FLICK_SPEED = 0.25;
// Released this close to a card, a flick still counts as on it: not a whole
// card further.
const ON_CARD = 0.04;

/**
 * The card a released swipe lands on, from the `position` it was let go at
 * (in cards), the way it was last moving (`heading`, ±1, 0 for unknown) and
 * the release `speed`. Never more than one card on from where it was let go.
 * Direction comes from the scroll's own movement, not the event's velocity:
 * Android reports that as the finger's, opposite in sign to iOS.
 */
export function releaseTarget(position: number, heading: number, speed: number): number {
  "worklet";
  if (speed >= FLICK_SPEED && heading !== 0) {
    return heading > 0 ? Math.ceil(position - ON_CARD) : Math.floor(position + ON_CARD);
  }
  return Math.round(position);
}
