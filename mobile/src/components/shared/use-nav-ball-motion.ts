import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

import { BOB_DISTANCE, BOB_DURATION, ICON_BOUNCE_SCALE } from "@/components/shared/bottom-nav-styles";

// Origami tension/friction 210/14, 180/10 and 220/7, as stiffness/damping.
const SLIDE_SPRING = { stiffness: 846, damping: 43, mass: 1 };
const SQUISH_SPRING = { stiffness: 737, damping: 31 };
const POP_SPRING = { stiffness: 882, damping: 22 };
// The ball's squash at the start of a switch: wider and flatter.
const SQUISH_X = 0.22;
const SQUISH_Y = 0.15;
const SQUISH_IN_MS = 90;
const POP_DELAY_MS = 60;
const POP_IN_MS = 120;
// The incoming icon on the ball waits this long into its fade, so the old one
// is mostly gone first.
const ICON_IN_MS = 240;
const ICON_IN_LEAD = POP_DELAY_MS / ICON_IN_MS;

// One breath (0 → 1 → 0) per cycle, sampled from a cosine so a single linear
// native timing can loop it.
const BOB_INPUT = Array.from({ length: 13 }, (_, k) => k / 12);
const BOB_OUTPUT = BOB_INPUT.map((t) => (1 - Math.cos(2 * Math.PI * t)) / 2);

// The squash and the icon pop are curves over ONE native 0 → 1 timing per
// switch, sampled from the springs they used to be. A sequence or a `delay`
// on the native driver is stepped from JS, and a switch is exactly when JS is
// busy mounting the next screen: the ball sat squashed until it was free.
const SWITCH_MS = 560;
const SWITCH_STEP_MS = 20;

// What is left of a spring released at 1 with no velocity, `ms` later.
function springRemainder(ms: number, { stiffness, damping }: { stiffness: number; damping: number }) {
  const omega = Math.sqrt(stiffness);
  const zeta = damping / (2 * omega);
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const s = ms / 1000;
  return Math.exp(-zeta * omega * s) * (Math.cos(omegaD * s) + ((zeta * omega) / omegaD) * Math.sin(omegaD * s));
}

function switchKeyframes(curve: (ms: number) => number, rest: number) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let ms = 0; ms <= SWITCH_MS; ms += SWITCH_STEP_MS) {
    inputRange.push(ms / SWITCH_MS);
    outputRange.push(ms === SWITCH_MS ? rest : curve(ms));
  }
  return { inputRange, outputRange };
}

const easeInOut = Easing.inOut(Easing.ease);
const squashAt = (ms: number) =>
  ms <= SQUISH_IN_MS ? easeInOut(ms / SQUISH_IN_MS) : springRemainder(ms - SQUISH_IN_MS, SQUISH_SPRING);
const SCALE_X_KEYS = switchKeyframes((ms) => 1 + SQUISH_X * squashAt(ms), 1);
const SCALE_Y_KEYS = switchKeyframes((ms) => 1 - SQUISH_Y * squashAt(ms), 1);
// 1 → 1.15 → 1, so the switch registers as a response to the tap, not a swap.
const POP_KEYS = switchKeyframes((ms) => {
  if (ms <= POP_DELAY_MS) return 1;
  const popped = ms - POP_DELAY_MS;
  if (popped <= POP_IN_MS) return 1 + (ICON_BOUNCE_SCALE - 1) * Easing.out(Easing.quad)(popped / POP_IN_MS);
  return 1 + (ICON_BOUNCE_SCALE - 1) * springRemainder(popped - POP_IN_MS, POP_SPRING);
}, 1);
const iconInEasing = (t: number) => (t <= ICON_IN_LEAD ? 0 : easeInOut((t - ICON_IN_LEAD) / (1 - ICON_IN_LEAD)));

const timing = (value: Animated.Value, toValue: number, duration: number, easing = easeInOut) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

function createBallMotion(tabCount: number, startIndex: number) {
  // ⚠️ Hidden until placed: at x 0 the ball would sit under the first tab
  // for a frame before the row is measured.
  const ballOpacity = new Animated.Value(0);
  const ballX = new Animated.Value(0);
  const bobPhase = new Animated.Value(0);
  // At rest at both ends: 1 is "no switch running".
  const switchProgress = new Animated.Value(1);
  // One opacity per tab's filled icon on the ball, all mounted at once; and
  // the row's outline icons, the active one faded out under the ball.
  const ballIconOpacities = Array.from({ length: tabCount }, (_, i) => new Animated.Value(i === startIndex ? 1 : 0));
  const rowOpacities = Array.from({ length: tabCount }, (_, i) => new Animated.Value(i === startIndex ? 0 : 1));

  const bob = bobPhase.interpolate({ inputRange: BOB_INPUT, outputRange: BOB_OUTPUT });

  return {
    ballOpacity,
    ballX,
    bobPhase,
    bob,
    followBall: { transform: [{ translateX: ballX }] },
    // The hairline and the hollow's rim: with the ball, and hidden until it is placed.
    revealFollow: { opacity: ballOpacity, transform: [{ translateX: ballX }] },
    bandCover: { opacity: ballOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
    ballStyle: {
      opacity: ballOpacity,
      transform: [
        { translateX: ballX },
        { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_DISTANCE] }) },
        { scaleX: switchProgress.interpolate(SCALE_X_KEYS) },
        { scaleY: switchProgress.interpolate(SCALE_Y_KEYS) },
      ],
    },
    iconPop: { transform: [{ scale: switchProgress.interpolate(POP_KEYS) }] },
    ballIconStyles: ballIconOpacities.map((opacity) => ({ opacity })),
    rowIconStyles: rowOpacities.map((opacity) => ({ opacity })),

    place(index: number, x: number) {
      ballX.setValue(x);
      ballIconOpacities.forEach((opacity, i) => opacity.setValue(i === index ? 1 : 0));
      rowOpacities.forEach((opacity, i) => opacity.setValue(i === index ? 0 : 1));
    },

    reveal() {
      timing(ballOpacity, 1, 120).start();
    },

    /**
     * Ball to `x`, icons to tab `index`. Every piece is one native animation,
     * started here and never stepped from JS again.
     *
     * The icon swap is a cross-fade between icons that are all mounted. Every
     * icon goes to its resting state, not just the two involved, so a switch
     * landing mid-way through the last leaves none half faded.
     */
    switchTo(index: number, x: number) {
      Animated.spring(ballX, { toValue: x, ...SLIDE_SPRING, useNativeDriver: true }).start();
      switchProgress.setValue(0);
      timing(switchProgress, 1, SWITCH_MS, Easing.linear).start();
      ballIconOpacities.forEach((opacity, i) =>
        (i === index ? timing(opacity, 1, ICON_IN_MS, iconInEasing) : timing(opacity, 0, 120)).start(),
      );
      rowOpacities.forEach((opacity, i) => timing(opacity, i === index ? 0 : 1, i === index ? 160 : 220).start());
    },
  };
}

/**
 * Every animated value of the BottomNav's ball, the styles built on them, and
 * the three moves made with them: place (first layout, no motion), reveal
 * (fade in once placed), and switchTo (a tab change). Split out of BottomNav
 * for the 300-line cap.
 *
 * ⚠️ RN Animated on the native driver, not Reanimated (back again,
 * 2026-10-26). On Android, Reanimated 4.1 applies each frame as a shadow-tree
 * commit and drops it while React is committing (ReanimatedModuleProxy::
 * performOperations, shouldReanimatedSkipCommit), so during a tab switch, the
 * moment React commits the most, the ball and its icons froze and jumped.
 * The native driver writes straight to the views. Its own trap, a render of
 * the nav sending the JS side's stale values back to them, is closed in
 * BottomNav: the views it animates are never re-rendered by a switch.
 *
 * Everything is created once, so the styles keep their identity for the
 * component's life: a new interpolation node on a native-driven view drops
 * the view back to its defaults for a frame.
 */
export function useNavBallMotion(tabCount: number, startIndex: number) {
  const [motion] = useState(() => createBallMotion(tabCount, startIndex));
  const { bobPhase } = motion;

  // Idle float, forever: it drives translateY only, while ballX and the
  // switch own translateX and scale, so a switch mid-float leaves it alone.
  useEffect(() => {
    const loop = Animated.loop(timing(bobPhase, 1, BOB_DURATION * 2, Easing.linear));
    loop.start();
    return () => loop.stop();
  }, [bobPhase]);

  return motion;
}
