import { useCallback, useEffect, useReducer, useRef } from "react";

import { API_MINOR_DIGITS, Evaluation, evaluateExpression } from "@/lib/calculator/evaluate";
import { currencyDecimals, formatExpression, formatValue, spokenExpression } from "@/lib/calculator/format";
import {
  CalcState,
  EMPTY_CALC,
  KeypadKey,
  backspace as backspaceState,
  confirm as confirmState,
  hasOperator,
  pressKey,
  rescale,
  seed,
} from "@/lib/calculator/input";

export interface AmountPreview {
  text: string;
  tone: "result" | "error";
}

export interface AmountExpression {
  /** Raw keypad text, e.g. "1500+250" — "." decimals, no grouping. */
  expression: string;
  /** Integer cents of the expression as it stands (a trailing operator
   *  ignored), or null while it has no value. Not yet checked for > 0. */
  cents: number | null;
  /** Display text, grouped in the currency's own locale; "0" when blank. */
  display: string;
  /** Screen-reader text: "5 cộng 3". */
  spoken: string;
  /** "= 8" under an expression, or why it has no value (÷0). */
  preview: AmountPreview | null;
  /** The currency's decimals — 0 swaps the "." key for "000". */
  decimals: number;
  /** Bumped on every key or ✓ that was refused — the display shakes on it. */
  rejectCount: number;
  /** Set when a wallet change rounded or cleared the amount. */
  notice: string | null;
  /** Why this amount cannot be saved, once it has a value; null otherwise. */
  problem: string | null;
  insert: (key: KeypadKey) => void;
  backspace: () => void;
  clear: () => void;
  /** Re-seeds from a stored amount in cents (null clears) — on every sheet open. */
  reset: (cents: number | null) => void;
  /** One ✓ tap: true when the amount is ready to submit; false when it was
   *  evaluated in place (or refused), so the user sees the result first. */
  confirm: () => boolean;
  /** Evaluates in place and returns the cents — for the header's "Lưu". */
  resolve: () => number | null;
}

interface Store {
  calc: CalcState;
  /** The decimals `calc` was last normalised for — a seed is exact cents. */
  calcDecimals: number;
  rejectCount: number;
  notice: string | null;
}

const ERROR_TEXT: Partial<Record<string, string>> = {
  divide_by_zero: "Không thể chia cho 0",
  out_of_range: "Vượt quá số tiền tối đa",
};

function valueOf(expression: string, decimals: number): Evaluation {
  return evaluateExpression(expression.replace(/[+−×÷]$/, ""), decimals);
}

/**
 * The amount state behind every keypad-driven transaction sheet.
 *
 * State lives in a ref, not useState: every key reads and writes the latest
 * value synchronously, so ten taps inside one frame are ten keys, never a
 * stale closure dropping some of them; a render is then requested.
 */
export function useAmountExpression(currency: string): AmountExpression {
  const decimals = currencyDecimals(currency);
  const store = useRef<Store>({ calc: EMPTY_CALC, calcDecimals: decimals, rejectCount: 0, notice: null });
  const decimalsRef = useRef(decimals);
  decimalsRef.current = decimals;
  const [, render] = useReducer((n: number) => n + 1, 0);

  const commit = useCallback((patch: Partial<Store>) => {
    store.current = { ...store.current, ...patch };
    render();
  }, []);
  const refuse = useCallback(() => commit({ rejectCount: store.current.rejectCount + 1 }), [commit]);

  // A wallet change to fewer decimals (USD → VND), or a seed made before the
  // wallet's currency was known: never keep "12.5" for a currency without
  // cents. Rounded the same half-up way as every result, and said out loud.
  useEffect(() => {
    if (store.current.calcDecimals === decimals) return;
    const outcome = rescale(store.current.calc, decimals);
    const notice =
      outcome.change === "rounded"
        ? `Đã làm tròn thành ${formatValue(outcome.state.expression, currency)} vì ${currency} không có phần lẻ.`
        : outcome.change === "cleared"
          ? `Đã xóa số tiền vì ${currency} không có phần lẻ.`
          : store.current.notice;
    commit({ calc: outcome.state, calcDecimals: decimals, notice });
  });

  const insert = useCallback(
    (key: KeypadKey) => {
      const result = pressKey(store.current.calc, key, decimalsRef.current);
      if (!result.accepted) return refuse();
      commit({ calc: result.state, notice: null });
    },
    [commit, refuse],
  );
  const backspace = useCallback(() => {
    if (store.current.calc.expression === "") return refuse();
    commit({ calc: backspaceState(store.current.calc), notice: null });
  }, [commit, refuse]);
  const clear = useCallback(() => commit({ calc: EMPTY_CALC, notice: null }), [commit]);
  const reset = useCallback(
    (cents: number | null) =>
      // Seeded at full cent precision — lossless whatever the currency — and
      // narrowed by the effect above once the wallet's currency is in.
      commit({ calc: seed(cents, API_MINOR_DIGITS), calcDecimals: API_MINOR_DIGITS, notice: null }),
    [commit],
  );

  const settle = (): number | null => {
    const outcome = confirmState(store.current.calc, decimalsRef.current);
    if (outcome.kind === "none" || outcome.kind === "error") {
      refuse();
      return null;
    }
    commit({ calc: outcome.state });
    const evaluation = evaluateExpression(outcome.state.expression, decimalsRef.current);
    return outcome.kind === "submit" && evaluation.ok ? evaluation.cents : null;
  };

  const confirm = () => settle() !== null;
  const resolve = () => {
    const outcome = confirmState(store.current.calc, decimalsRef.current);
    if (outcome.kind === "evaluated") {
      commit({ calc: outcome.state });
      const evaluation = evaluateExpression(outcome.state.expression, decimalsRef.current);
      return evaluation.ok ? evaluation.cents : null;
    }
    return settle();
  };

  const { calc, rejectCount, notice } = store.current;
  const evaluation = valueOf(calc.expression, decimals);
  const showPreview = hasOperator(calc.expression) && !calc.justEvaluated;
  const errorText = !evaluation.ok ? ERROR_TEXT[evaluation.error] : undefined;

  let preview: AmountPreview | null = null;
  if (showPreview && evaluation.ok) preview = { text: `= ${formatValue(evaluation.text, currency)}`, tone: "result" };
  else if (showPreview && errorText) preview = { text: errorText, tone: "error" };

  let problem: string | null = errorText ?? null;
  if (evaluation.ok && evaluation.cents <= 0) {
    problem = evaluation.roundedToZero
      ? `Số tiền làm tròn về 0 — nhỏ hơn đơn vị nhỏ nhất của ${currency}.`
      : "Số tiền phải lớn hơn 0.";
  }

  return {
    expression: calc.expression,
    cents: evaluation.ok ? evaluation.cents : null,
    display: formatExpression(calc.expression, currency),
    spoken: calc.expression ? spokenExpression(calc.expression) : "Chưa nhập số tiền",
    preview,
    decimals,
    rejectCount,
    notice,
    problem,
    insert,
    backspace,
    clear,
    reset,
    confirm,
    resolve,
  };
}
