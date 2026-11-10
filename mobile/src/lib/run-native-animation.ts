import { Animated } from "react-native";

// Which run of each value is the latest, so a late "finished" from an older
// one never resets a value a newer run is animating.
const runIds = new WeakMap<Animated.Value, number>();

/**
 * Starts a native-driver animation of `value` towards `to` without RN's end
 * sync, then syncs the value once itself, only when the run comes to rest.
 * `onRest` runs then too (not for a run cut short by a newer one).
 *
 * ⚠️ RN's end sync re-renders every view using the value (Animation.js), and
 * every React commit is expensive here: Reanimated re-applies the props of
 * every view it has ever animated on each one (ReanimatedCommitHook), a few
 * hundred prop updates on the UI thread (2026-11-10). A run that is cut short
 * is worse: RN writes the value it stopped at into the JS side and that
 * re-render commits late, after the new run has moved on, so the view jumps
 * back for a frame (the nav ball on a quick second tap).
 *
 * `isLooping`, start()'s second argument (internal, not in the types;
 * Animated.loop passes it), skips that re-render; the JS value is still
 * synced. The setValue below then makes the resting value the one React
 * commits next. If a future RN drops the argument it is ignored and only the
 * extra renders come back.
 */
export function runNativeAnimation(
  value: Animated.Value,
  to: number,
  animation: Animated.CompositeAnimation,
  onRest?: () => void,
) {
  const id = (runIds.get(value) ?? 0) + 1;
  runIds.set(value, id);
  const start = animation.start as (callback?: Animated.EndCallback, isLooping?: boolean) => void;
  start.call(
    animation,
    ({ finished }) => {
      if (!finished || runIds.get(value) !== id) return;
      value.setValue(to);
      onRest?.();
    },
    true,
  );
}
