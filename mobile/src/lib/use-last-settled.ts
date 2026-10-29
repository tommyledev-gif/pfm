import { useRef } from "react";

/**
 * The last `value` seen while `pending` was false; null if there has not been
 * one yet. For content that keeps its previous answer on screen while a new
 * one loads, when the query itself cannot (its key changed shape, or the
 * value is derived from several sources).
 */
export function useLastSettled<T>(value: T, pending: boolean): T | null {
  const settled = useRef<T | null>(null);
  if (!pending) settled.current = value;
  return settled.current;
}
