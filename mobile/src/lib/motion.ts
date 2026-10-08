import { useEffect, useRef } from "react";
import { Animated, Easing, InteractionManager } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// Re-exported rather than re-implemented: lib/use-reduce-motion.ts already
// reads AccessibilityInfo.isReduceMotionEnabled() and follows
// `reduceMotionChanged`, with the listener removed on unmount. Level
// animations import both from here so the motion vocabulary has one home.
export { useReduceMotion };

/**
 * The "liquid" settle every level/progress indicator shares: an underdamped
 * spring with exactly one visible overshoot.
 *
 *   ζ = damping / (2·√(stiffness·mass)) = 16 / (2·√180) ≈ 0.60
 *   overshoot = e^(−ζπ/√(1−ζ²)) ≈ 9.7% of the distance travelled
 *   settle (2%) ≈ 4 / (ζ·ωn) ≈ 0.5s
 *
 * Same stiffness/damping/mass form as Drawer.tsx's sheet spring. Only ever
 * passed to `Animated.spring` with the native driver.
 */
export const LEVEL_SPRING = { stiffness: 180, damping: 16, mass: 1 } as const;

/** Reduce Motion: a short ease to the new level, no spring and no overshoot. */
export const REDUCED_MOTION_MS = 150;

type SpringConfig = { stiffness: number; damping: number; mass: number };

const criticalDamping = ({ stiffness, mass }: SpringConfig) => 2 * Math.sqrt(stiffness * mass);

/** Fraction of the travelled distance an underdamped spring overshoots by. */
export function springOvershoot(config: SpringConfig = LEVEL_SPRING): number {
  const zeta = config.damping / criticalDamping(config);
  if (zeta >= 1) return 0;
  return Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
}

/**
 * A level as a finite number inside [min, max]. NaN, ±Infinity, undefined and
 * negatives all land on a bound, so nothing downstream ever interpolates NaN.
 */
export function clampLevel(value: unknown, min = 0, max = 1): number {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * LEVEL_SPRING, damped just enough that its one overshoot stays inside
 * [floor, ceiling].
 *
 * A spring's overshoot is a fixed fraction of the distance it travels, so it
 * cannot simply be capped — clamping the output would flatten the bounce into
 * a visible stall against the limit. Instead ζ is raised for this one move
 * until `overshoot × span` fits the headroom left past the target. A small
 * move (one more transaction) keeps the full ~9.7% bounce; a long move that
 * ends near a limit settles in more firmly; a move that ends ON a limit is
 * critically damped and does not overshoot at all.
 *
 * `from`/`to` are the previous move's ends. The value may have been caught
 * anywhere between them (a refetch can retarget mid-flight), so the span is
 * taken from whichever end is farther, and both directions are guarded when
 * the target lies inside that range.
 */
export function levelSpringFor(
  from: number,
  to: number,
  target: number,
  floor = -Infinity,
  ceiling = Infinity,
): SpringConfig {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const span = Math.max(Math.abs(target - lo), Math.abs(target - hi));
  if (span === 0) return { ...LEVEL_SPRING };

  const headroomUp = lo < target ? ceiling - target : Infinity;
  const headroomDown = hi > target ? target - floor : Infinity;
  const allowed = Math.min(headroomUp, headroomDown) / span;

  if (allowed >= springOvershoot(LEVEL_SPRING)) return { ...LEVEL_SPRING };
  // Below ~0.1% the bounce is sub-pixel anyway; ζ = 1 is the honest answer.
  if (allowed <= 0.001) return { ...LEVEL_SPRING, damping: criticalDamping(LEVEL_SPRING) };

  // Inverse of springOvershoot: ζ = −ln(OS) / √(π² + ln²(OS)).
  const ln = Math.log(allowed);
  const zeta = -ln / Math.sqrt(Math.PI * Math.PI + ln * ln);
  return { ...LEVEL_SPRING, damping: zeta * criticalDamping(LEVEL_SPRING) };
}

interface LevelAnimationOptions {
  /** Where the value sits on mount. The first move away from it is the intro. */
  initial: number;
  /** How far the overshoot may reach past the target, either side. */
  floor?: number;
  ceiling?: number;
}

/**
 * An Animated.Value that follows `target` with LEVEL_SPRING on the native
 * driver — for transforms/opacity only.
 *
 * - Mount: plays the intro from `initial`, once the JS thread is idle (same
 *   reasoning as useEntryAnimation: a screen's first frames are its busiest).
 *   Every later change is an update and starts immediately.
 * - Retargeted mid-flight: the previous animation is stopped and the new one
 *   starts from wherever the native value actually is — the native spring
 *   reads its start position from the node, so nothing teleports. (Velocity
 *   does restart at zero; carrying it over would need a JS listener on every
 *   frame.)
 * - Reduce Motion: a REDUCED_MOTION_MS ease with no overshoot.
 * - Unmount: the animation is stopped. No React state is touched, so there is
 *   nothing to warn about.
 */
export function useLevelAnimation(
  target: number,
  { initial, floor, ceiling }: LevelAnimationOptions,
): Animated.Value {
  const reduceMotion = useReduceMotion();
  const value = useRef(new Animated.Value(initial)).current;
  const lastMove = useRef({ from: initial, to: initial });
  const introScheduled = useRef(false);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    const run = () => {
      const { from, to } = lastMove.current;
      // Keep whichever previous end is farther from the new target as this
      // move's "from" — the bound the next retarget has to respect.
      const farther = Math.abs(target - from) > Math.abs(target - to) ? from : to;
      lastMove.current = { from: farther, to: target };
      animation = reduceMotion
        ? Animated.timing(value, {
            toValue: target,
            duration: REDUCED_MOTION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          })
        : Animated.spring(value, {
            toValue: target,
            ...levelSpringFor(from, to, target, floor, ceiling),
            useNativeDriver: true,
          });
      animation.start();
    };

    if (!introScheduled.current) {
      introScheduled.current = true;
      const task = InteractionManager.runAfterInteractions(run);
      return () => {
        task.cancel();
        animation?.stop();
      };
    }

    run();
    return () => animation?.stop();
  }, [target, reduceMotion, value, floor, ceiling]);

  return value;
}
