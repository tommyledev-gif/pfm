import { useEffect, useState } from "react";

/**
 * `value`, except that turning false only lands after `ms` — and not at all if
 * it turns true again first. For something shown while either of two inputs
 * has focus: moving between them blurs one before the other gains it, and
 * hiding in that gap would unmount the input about to be focused.
 */
export function useLinger(value: boolean, ms: number): boolean {
  const [held, setHeld] = useState(value);

  useEffect(() => {
    if (value) {
      setHeld(true);
      return;
    }
    const timer = setTimeout(() => setHeld(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return value || held;
}
