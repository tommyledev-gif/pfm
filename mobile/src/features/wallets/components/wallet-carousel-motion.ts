import { useEffect } from "react";
import {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SNAP_INTERVAL } from "@/features/wallets/components/use-wallet-carousel";
import {
  SHEEN_ANGLE,
  SHEEN_X_FROM_LEFT,
  SHEEN_X_FROM_RIGHT,
} from "@/features/wallets/components/wallet-card-geometry";

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

// ── Dealing in ───────────────────────────────────────────────────────────
// When the carousel first appears, every card on screen starts stacked under
// the centre one, 18px low and transparent, and springs out to its resting
// place: the deck is dealt rather than the row popping in. One value for the
// whole carousel, 0 → 1 (a little past 1 while the spring overshoots, which
// is what flicks the neighbours out and back).
const INTRO_RISE = 18;
const INTRO_DELAY_MS = 60;
const INTRO_SPRING = { damping: 15, stiffness: 140, mass: 1 };
// Only cards this close to the centre are pulled into the stack. The loop
// copies further out are transparent anyway, and leaving them where they are
// keeps an invisible card from sweeping across the centre and catching a tap.
const INTRO_REACH = 2;

// A touch on a card presses it into the screen a little, so the tap visibly
// lands before the card slides over or opens.
const PRESS_SHRINK = 0.045;

/**
 * The carousel's deal-in: 0 until `ready` (laid out, with wallets), then
 * sprung to 1. Reanimated skips straight to the end when the OS has reduce
 * motion on, so the cards then simply appear in place.
 */
export function useCarouselIntro(ready: boolean): SharedValue<number> {
  const intro = useSharedValue(0);
  useEffect(() => {
    if (ready) intro.value = withDelay(INTRO_DELAY_MS, withSpring(1, INTRO_SPRING));
  }, [ready, intro]);
  return intro;
}

/** The 0 → 1 press depth for one card, and the handlers that drive it. */
export function useCardPress() {
  const pressed = useSharedValue(0);
  return {
    pressed,
    onPressIn: () => {
      pressed.value = withTiming(1, { duration: 110 });
    },
    onPressOut: () => {
      pressed.value = withSpring(0, { damping: 12, stiffness: 260 });
    },
  };
}

/**
 * One card's motion: position, tilt, scale, fade and paint order, all from
 * the carousel's scroll offset on the UI thread, plus the deal-in, the press,
 * the rim's fade-in for whichever card is centred, and the light streak.
 */
export function useCardMotion(
  index: number,
  scrollX: SharedValue<number>,
  intro: SharedValue<number>,
  pressed: SharedValue<number>,
) {
  const card = useAnimatedStyle(() => {
    // -1 is one card left of centre, 0 is centred.
    const offset = index - scrollX.value / SNAP_INTERVAL;
    const distance = Math.abs(offset);
    const layer = distance < 0.5 ? 3 : distance < 1.5 ? 2 : 1;
    const settledX = interpolate(offset, SHUFFLE_INPUT, SHUFFLE_OUTPUT, Extrapolation.CLAMP);
    // Where the scroll alone would have to be undone to put this card dead
    // centre, under the centred card.
    const stackedX = -offset * SNAP_INTERVAL;
    const stacked = distance <= INTRO_REACH ? 1 - intro.value : 0;
    return {
      zIndex: layer,
      elevation: LAYER_ELEVATION[layer],
      opacity:
        interpolate(offset, FAR, OPACITY, Extrapolation.CLAMP) *
        interpolate(intro.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
      transform: [
        { perspective: CARD_PERSPECTIVE },
        { translateX: settledX + (stackedX - settledX) * stacked },
        { translateY: (1 - intro.value) * INTRO_RISE },
        // A right-hand card turns its right edge away, a left-hand one its left.
        { rotateY: `${interpolate(offset, NEAR, TILT, Extrapolation.CLAMP)}deg` },
        { scale: interpolate(offset, FAR, SCALE, Extrapolation.CLAMP) * (1 - PRESS_SHRINK * pressed.value) },
      ],
    };
  });
  const active = useAnimatedStyle(() => ({
    opacity: interpolate(index - scrollX.value / SNAP_INTERVAL, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
  }));
  // Runs against the card's own travel, so on screen the streak holds nearly
  // still while the card slides under it, the way a fixed lamp's reflection
  // does. Lit only mid-swipe: dark at rest and at the neighbour position.
  const sheen = useAnimatedStyle(() => {
    const offset = index - scrollX.value / SNAP_INTERVAL;
    return {
      opacity: interpolate(Math.abs(offset), [0, 0.12, 0.45, 0.9], [0, 0.5, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(offset, [-1, 1], [SHEEN_X_FROM_LEFT, SHEEN_X_FROM_RIGHT], Extrapolation.CLAMP) },
        { rotate: SHEEN_ANGLE },
      ],
    };
  });
  return { card, active, sheen };
}

export type CardMotion = ReturnType<typeof useCardMotion>;
