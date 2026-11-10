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
// Breaths after the nav appears and after each switch, then still. A float
// that never ended kept the app drawing a frame every vsync on every tab
// (~60 fps, ~30% of a core on the render thread with nothing else moving —
// perf audit 2026-11-03), and an app that never goes idle also stalls UI
// automation waiting for it. A breath ends where it starts, at rest, so
// stopping after whole ones shows no jump.
const BOB_BREATHS = 3;

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

// Which run of each value is the latest, so a late "finished" from an older
// one never resets a value a newer run is animating.
const runIds = new WeakMap<Animated.Value, number>();

/**
 * Starts a native animation of `value` towards `to` without RN's end sync,
 * then syncs it once itself, only when the run comes to rest.
 *
 * ⚠️ RN's end sync is what made the ball jump back on a quick second tap
 * (2026-11-10). Starting a run stops the one in flight, and RN then writes the
 * value it stopped at into the JS side and re-renders every view using it
 * (Animation.js). With JS busy with the first tap's navigation, that
 * re-render only commits hundreds of ms later, when the new run has long
 * moved on: the ball, an icon or a squash showed the stopped run's value for
 * a frame. `isLooping`, start()'s second argument (internal, not in the
 * types; Animated.loop passes it), skips that re-render; the JS value is
 * still synced. The setValue below then commits the resting value once, so
 * Fabric's shadow tree never keeps a stale one. If a future RN drops the
 * argument it is ignored and only the quick-tap case regresses.
 */
function run(value: Animated.Value, to: number, animation: Animated.CompositeAnimation) {
  const id = (runIds.get(value) ?? 0) + 1;
  runIds.set(value, id);
  const start = animation.start as (callback?: Animated.EndCallback, isLooping?: boolean) => void;
  start.call(
    animation,
    ({ finished }) => {
      if (finished && runIds.get(value) === id) value.setValue(to);
    },
    true,
  );
}

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

  // A float already running carries on rather than restarting: a native loop
  // started part-way would jump back to that point on every breath.
  let floating: Animated.CompositeAnimation | null = null;
  const float = () => {
    if (floating) return;
    bobPhase.setValue(0);
    const run = Animated.loop(timing(bobPhase, 1, BOB_DURATION * 2, Easing.linear), { iterations: BOB_BREATHS });
    floating = run;
    run.start(() => {
      if (floating === run) floating = null;
    });
  };

  return {
    ballOpacity,
    ballX,
    bobPhase,
    bob,
    followBall: { transform: [{ translateX: ballX }] },
    // Everything that rides the ball (hairline, rim, light, ball): hidden
    // until it is placed. One layer over all of them, not an opacity on each.
    revealed: { opacity: ballOpacity },
    bandCover: { opacity: ballOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
    ballBob: { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_DISTANCE] }) }] },
    ballSquash: {
      transform: [
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

    float,

    stopFloat() {
      floating?.stop();
      floating = null;
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
      run(ballX, x, Animated.spring(ballX, { toValue: x, ...SLIDE_SPRING, useNativeDriver: true }));
      switchProgress.setValue(0);
      run(switchProgress, 1, timing(switchProgress, 1, SWITCH_MS, Easing.linear));
      ballIconOpacities.forEach((opacity, i) =>
        i === index
          ? run(opacity, 1, timing(opacity, 1, ICON_IN_MS, iconInEasing))
          : run(opacity, 0, timing(opacity, 0, 120)),
      );
      rowOpacities.forEach((opacity, i) =>
        run(opacity, i === index ? 0 : 1, timing(opacity, i === index ? 0 : 1, i === index ? 160 : 220)),
      );
      float();
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
 * ⚠️ ONE animated value per view (2026-11-10). RN re-renders an animated view
 * itself when one of its native animations ends (Animation.js: the value is
 * synced to JS, then every view using it gets `scheduleUpdate`), and that
 * render commits the JS side of EVERY value on the view. The ball used to
 * carry ballX, the bob and the squash in one transform: the squash's 560ms
 * timing ended before the slide's spring had reported rest, so the ball was
 * re-rendered with ballX still where it was before the tap. On the emulator
 * the ball jumped back to the old tab for 1-10 frames on most switches while
 * the hollow (ballX only) stayed put. Hence the nested layers in BottomNav:
 * slot (ballX) → bob → squash, under one reveal layer (ballOpacity).
 *
 * Everything is created once, so the styles keep their identity for the
 * component's life: a new interpolation node on a native-driven view drops
 * the view back to its defaults for a frame.
 */
export function useNavBallMotion(tabCount: number, startIndex: number) {
  const [motion] = useState(() => createBallMotion(tabCount, startIndex));

  // Idle float, BOB_BREATHS at a time (switchTo starts the next): it drives
  // translateY only, while ballX and the switch own translateX and scale, so
  // a switch mid-float leaves it alone.
  useEffect(() => {
    motion.float();
    return motion.stopFloat;
  }, [motion]);

  return motion;
}
