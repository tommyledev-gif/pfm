import { useMemo } from "react";
import { Animated } from "react-native";

import { SNAP_INTERVAL } from "@/features/wallets/components/use-wallet-carousel";

// ── The resting stack ────────────────────────────────────────────────────
// The centred card faces the user. Each neighbour sits tucked behind it,
// smaller, dimmed and turned away (its outer edge leaning back), so only a
// strip of it shows beside the centre card. Positions are centre-to-centre
// offsets from the middle of the carousel, in px.
//
// The finger still travels a full SNAP_INTERVAL per card; the cards just
// stack much tighter than that instead of lining up.
const NEIGHBOUR_X = 82;
const NEIGHBOUR_SCALE = 0.84;
const NEIGHBOUR_OPACITY = 0.55;
const NEIGHBOUR_TILT = "32deg";
// The card two places out waits hidden behind the neighbour, smaller and
// fully transparent, and fades in from there as it moves up. Kept inside the
// neighbour's footprint so the invisible card never catches a tap.
const FAR_X = 90;
const FAR_SCALE = 0.74;
// Depth for the tilt. ⚠️ Has to stay the first entry of the transform list:
// a perspective after a rotation has no effect, and on Android it is what
// sets the camera distance.
export const CARD_PERSPECTIVE = 900;

// ── The swap is a shuffle, not a cross-fade ──────────────────────────────
// A card's path is keyed by its distance from the centre in snap intervals
// (1 = resting neighbour, 0 = centred). Coming in, it first slides OUT from
// behind the centre card, holds clear of it through the middle of the swipe,
// then sweeps in over it. The path is mirrored, so the outgoing card runs the
// same one in reverse: out to the side, then tucking back under.
//
// ⚠️ Why: paint order flips at the halfway mark. Resting neighbours overlap
// the centre card by design, so if the two swapping cards still overlapped
// there, the incoming one would visibly jump on top. Between 0.3 and 0.7 of a
// swipe the two cards do not overlap (8px clear at the halfway mark, 3px at
// the window's edges, tilt and perspective included), so the flip lands
// unseen. Change a scale, tilt or position above and these need re-checking.
//
// On Android the flip is the elevation below, on the native driver, so it
// lands exactly at the halfway mark at any swipe speed. It used to follow
// the JS zIndex (centreIndex): a quick flick crossed the whole 0.3–0.7 window
// before that re-render landed, and the cards swapped over while overlapping.
// iOS still orders by that JS zIndex: Fabric there has no native zIndex.
const SWAP_INNER_X = 106; // at 0.3
const SWAP_CLEAR_X = 112; // from 0.5 to 0.7
const KEYFRAMES: [offset: number, x: number][] = [
  [0, 0],
  [0.3, SWAP_INNER_X],
  [0.5, SWAP_CLEAR_X],
  [0.7, SWAP_CLEAR_X],
  [1, NEIGHBOUR_X],
  [2, FAR_X],
];
// Mirrored for the left side. Each output is the target position minus where
// the scroll alone puts the card (that many snap intervals from the centre).
const SHUFFLE_INPUT = [...KEYFRAMES.slice(1).reverse().map(([o]) => -o), ...KEYFRAMES.map(([o]) => o)];
const SHUFFLE_OUTPUT = SHUFFLE_INPUT.map((offset) => {
  const x = KEYFRAMES.find(([o]) => o === Math.abs(offset))![1];
  return Math.sign(offset) * x - offset * SNAP_INTERVAL;
});

const NEAR = [-1, 0, 1];
const FAR = [-2, -1, 0, 1, 2];

// Android draws siblings in elevation order before zIndex. Falling steadily
// with distance from the centre, it puts the incoming card over the outgoing
// one exactly where their distances cross: the halfway mark. Kept in a small
// range because elevation is also the shadow's size.
const CENTRE_ELEVATION = 8;
const NEIGHBOUR_ELEVATION = 7;
const FAR_ELEVATION = 6;

/**
 * Each rendered card's native-driven motion, built once per card count.
 *
 * ⚠️ Built in a memo rather than inline in render: a new interpolation chain
 * per card per render meant every re-render of Home rebuilt the whole native
 * animation graph for three copies of every wallet.
 */
export function useCardMotion(count: number, scrollX: Animated.Value) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        // -1 is one card left of centre, 0 is centred.
        const offset = Animated.subtract(index, Animated.divide(scrollX, SNAP_INTERVAL));
        return {
          translateX: offset.interpolate({ inputRange: SHUFFLE_INPUT, outputRange: SHUFFLE_OUTPUT, extrapolate: "clamp" }),
          scale: offset.interpolate({
            inputRange: FAR,
            outputRange: [FAR_SCALE, NEIGHBOUR_SCALE, 1, NEIGHBOUR_SCALE, FAR_SCALE],
            extrapolate: "clamp",
          }),
          // A right-hand card turns its right edge away, a left-hand one its left.
          rotateY: offset.interpolate({
            inputRange: NEAR,
            outputRange: [`-${NEIGHBOUR_TILT}`, "0deg", NEIGHBOUR_TILT],
            extrapolate: "clamp",
          }),
          opacity: offset.interpolate({
            inputRange: FAR,
            outputRange: [0, NEIGHBOUR_OPACITY, 1, NEIGHBOUR_OPACITY, 0],
            extrapolate: "clamp",
          }),
          elevation: offset.interpolate({
            inputRange: FAR,
            outputRange: [FAR_ELEVATION, NEIGHBOUR_ELEVATION, CENTRE_ELEVATION, NEIGHBOUR_ELEVATION, FAR_ELEVATION],
            extrapolate: "clamp",
          }),
          // Fades the accent border in on whichever card is centred.
          active: offset.interpolate({ inputRange: [-0.6, 0, 0.6], outputRange: [0, 1, 0], extrapolate: "clamp" }),
        };
      }),
    [count, scrollX],
  );
}
