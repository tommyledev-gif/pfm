import { useEffect, useState } from "react";

// Past this, ready anyway — a JS thread that never goes idle (a long list
// still mounting) must not leave a control disabled indefinitely.
const IDLE_TIMEOUT_MS = 400;

/**
 * False on mount, true once the JS thread has had its first idle moment
 * since — i.e. the mount work around this component (the rest of a sheet
 * rendering, its effects settling) is done, so a tap is answered at once
 * instead of queueing behind it.
 */
export function useJsIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const handle = requestIdleCallback(() => setIdle(true), { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }, []);
  return idle;
}
