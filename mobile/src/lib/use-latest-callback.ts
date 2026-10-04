import { useCallback, useRef } from "react";

/**
 * A callback whose identity never changes but which always runs the latest
 * `fn`. For handlers passed into memoized list rows: a fresh arrow on every
 * render would re-render every row on every keystroke of the screen's input.
 */
export function useLatestCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Args) => ref.current(...args), []);
}
