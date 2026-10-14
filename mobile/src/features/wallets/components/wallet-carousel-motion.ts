import { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from "react-native-reanimated";

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
const NEIGHBOUR_TILT_DEG = 32;
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
// the window's edges, tilt and perspective included). Change a scale, tilt or
// position above and these need re-checking.
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
const TILT = [-NEIGHBOUR_TILT_DEG, 0, NEIGHBOUR_TILT_DEG];
const SCALE = [FAR_SCALE, NEIGHBOUR_SCALE, 1, NEIGHBOUR_SCALE, FAR_SCALE];
const OPACITY = [0, NEIGHBOUR_OPACITY, 1, NEIGHBOUR_OPACITY, 0];

// ── Paint order ──────────────────────────────────────────────────────────
// Three layers by distance from the centre, stepping exactly at 0.5 (the
// swapping pair, then clear of each other) and at 1.5 (a neighbour and the
// card behind it). Worked out on the UI thread from the same scroll value as
// the movement, frame by frame: it used to be React state, re-rendered once
// the JS thread caught up, and a quick flick crossed the whole clear window
// before that landed, so cards jumped over each other while overlapping.
// Stepped, not continuous, because a zIndex change re-sorts the views; it now
// happens twice per swipe instead of on every frame. Android sorts by
// elevation before zIndex, so elevation steps with it, kept small because it
// is also the shadow's size.
const LAYER_ELEVATION = [0, 6, 7, 8];

/**
 * One card's motion: position, tilt, scale, fade and paint order, all from
 * the carousel's scroll offset on the UI thread, plus the accent border's
 * fade-in for whichever card is centred.
 */
export function useCardMotion(index: number, scrollX: SharedValue<number>) {
  const card = useAnimatedStyle(() => {
    // -1 is one card left of centre, 0 is centred.
    const offset = index - scrollX.value / SNAP_INTERVAL;
    const distance = Math.abs(offset);
    const layer = distance < 0.5 ? 3 : distance < 1.5 ? 2 : 1;
    return {
      zIndex: layer,
      elevation: LAYER_ELEVATION[layer],
      opacity: interpolate(offset, FAR, OPACITY, Extrapolation.CLAMP),
      transform: [
        { perspective: CARD_PERSPECTIVE },
        { translateX: interpolate(offset, SHUFFLE_INPUT, SHUFFLE_OUTPUT, Extrapolation.CLAMP) },
        // A right-hand card turns its right edge away, a left-hand one its left.
        { rotateY: `${interpolate(offset, NEAR, TILT, Extrapolation.CLAMP)}deg` },
        { scale: interpolate(offset, FAR, SCALE, Extrapolation.CLAMP) },
      ],
    };
  });
  const active = useAnimatedStyle(() => ({
    opacity: interpolate(index - scrollX.value / SNAP_INTERVAL, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
  }));
  return { card, active };
}

export type CardMotion = ReturnType<typeof useCardMotion>;
