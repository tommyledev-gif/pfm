import { useCallback, useMemo, useState } from "react";

import {
  centsToExpression,
  confirmExpression,
  evaluateToCents,
  formatExpressionDisplay,
  insertToken,
} from "@/lib/calculator-engine";

export interface AmountExpression {
  /** Raw keypad text, e.g. "1500+250". */
  expression: string;
  /** Integer cents the expression evaluates to, or null while incomplete/invalid. */
  cents: number | null;
  /** Display text: grouped and spaced, "0" when blank. */
  display: string;
  insert: (token: string) => void;
  backspace: () => void;
  clear: () => void;
  /** Re-seeds from a stored amount (null clears) — on every sheet open. */
  reset: (cents: number | null) => void;
  /**
   * One ✓ tap: true when the amount is ready to submit; false when the tap
   * instead evaluated or trimmed an operator expression in place (or it
   * cannot resolve yet), so the user reviews the result first.
   */
  confirm: () => boolean;
  /**
   * Evaluates any pending expression in place and returns its cents — for a
   * submit that does not go through the ✓ key (the header's "Lưu").
   */
  resolve: () => number | null;
}

/** The amount state behind every keypad-driven transaction sheet. */
export function useAmountExpression(): AmountExpression {
  const [expression, setExpression] = useState("");

  const cents = useMemo(() => evaluateToCents(expression), [expression]);
  const display = useMemo(() => formatExpressionDisplay(expression), [expression]);

  const insert = useCallback((token: string) => setExpression((prev) => insertToken(prev, token)), []);
  const backspace = useCallback(() => setExpression((prev) => prev.slice(0, -1)), []);
  const clear = useCallback(() => setExpression(""), []);
  const reset = useCallback((next: number | null) => setExpression(next === null ? "" : centsToExpression(next)), []);

  const confirm = () => {
    const outcome = confirmExpression(expression);
    if (outcome === null) return false;
    if ("edit" in outcome) {
      setExpression(outcome.edit);
      return false;
    }
    return true;
  };

  const resolve = () => {
    const outcome = confirmExpression(expression);
    if (outcome && "edit" in outcome) {
      setExpression(outcome.edit);
      return evaluateToCents(outcome.edit);
    }
    return cents;
  };

  return { expression, cents, display, insert, backspace, clear, reset, confirm, resolve };
}
