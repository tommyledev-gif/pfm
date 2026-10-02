import {
  AMOUNT_MAX_INTEGER_DIGITS,
  API_MINOR_DIGITS,
  OPERATOR_GLYPHS,
  OperatorGlyph,
  evaluateExpression,
} from "@/lib/calculator/evaluate";

// The amount keypad's state machine: one pure function per key, so every
// rule below is a test vector and a fast double tap can never read a stale
// value. The expression is plain keypad text — digits, "." and + − × ÷ —
// with no grouping separators ever; grouping is display-only (format.ts).

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "000" | "." | OperatorGlyph;

export interface CalcState {
  expression: string;
  /** The expression is a result ✓ just produced: the next digit starts over,
   *  the next operator continues from it. */
  justEvaluated: boolean;
}

export const EMPTY_CALC: CalcState = { expression: "", justEvaluated: false };

/** Keeps "1+1+1+…" from growing without end (and the display with it). */
export const MAX_EXPRESSION_LENGTH = 40;
const THOUSANDS = "000";

export type KeyResult = { state: CalcState; accepted: boolean };

const isOperator = (ch: string): ch is OperatorGlyph => (OPERATOR_GLYPHS as readonly string[]).includes(ch);

/** The operand being typed — everything after the last operator. */
function currentOperand(expression: string): string {
  let i = expression.length - 1;
  while (i >= 0 && !isOperator(expression.charAt(i))) i--;
  return expression.slice(i + 1);
}

export function endsWithOperator(expression: string): boolean {
  return expression !== "" && isOperator(expression.charAt(expression.length - 1));
}

export function hasOperator(expression: string): boolean {
  return [...expression].some(isOperator);
}

const reject = (state: CalcState): KeyResult => ({ state, accepted: false });
// Every accepted key also clears justEvaluated: what follows edits the text.
const accept = (prev: CalcState, expression: string): KeyResult =>
  expression.length > MAX_EXPRESSION_LENGTH ? reject(prev) : { state: { expression, justEvaluated: false }, accepted: true };

function pressDigits(state: CalcState, digits: string, decimals: number): KeyResult {
  // A digit right after ✓ starts a new amount instead of growing the result.
  const base = state.justEvaluated ? "" : state.expression;
  const operand = currentOperand(base);
  const [whole, fraction] = operand.split(".");

  if (digits === THOUSANDS) {
    // Only ever multiplies a number already being typed: on nothing, on 0, or
    // on a decimal part it would mean nothing (or overflow the decimals).
    if (whole === "" || whole === "0" || fraction !== undefined) return reject(state);
    if (whole.length + THOUSANDS.length > AMOUNT_MAX_INTEGER_DIGITS) return reject(state);
    return accept(state, base + THOUSANDS);
  }
  if (fraction !== undefined) {
    if (fraction.length >= decimals) return reject(state);
    return accept(state, base + digits);
  }
  // A lone leading zero is replaced, per operand: "0"+"5" → "5", "5+0"+"7" → "5+7".
  if (whole === "0") return accept(state, base.slice(0, -1) + digits);
  if (whole.length >= AMOUNT_MAX_INTEGER_DIGITS) return reject(state);
  return accept(state, base + digits);
}

function pressPoint(state: CalcState, decimals: number): KeyResult {
  if (decimals === 0) return reject(state);
  if (state.justEvaluated) return accept(state, "0.");
  const operand = currentOperand(state.expression);
  if (operand.includes(".")) return reject(state);
  return accept(state, operand === "" ? `${state.expression}0.` : `${state.expression}.`);
}

function pressOperator(state: CalcState, op: OperatorGlyph): KeyResult {
  // Nothing to operate on — and no leading "−" either (no negative amounts).
  if (state.expression === "") return reject(state);
  // A dangling point never reaches the evaluator: "5." then "×" is "5×".
  let base = state.expression.replace(/\.$/, "");
  // A second operator replaces the first: "5+" then "×" is "5×", never "5+×".
  if (endsWithOperator(base)) base = base.slice(0, -1);
  if (base === "") return reject(state);
  return accept(state, base + op);
}

/** One key press. `decimals` is the currency's (0 VND, 2 USD). */
export function pressKey(state: CalcState, key: KeypadKey, decimals: number): KeyResult {
  if (key === ".") return pressPoint(state, decimals);
  if (isOperator(key)) return pressOperator(state, key);
  return pressDigits(state, key, decimals);
}

/** ⌫ — one character, from wherever the text is (a ✓ result included). */
export function backspace(state: CalcState): CalcState {
  if (state.expression === "") return state;
  return { expression: state.expression.slice(0, -1), justEvaluated: false };
}

/**
 * A stored amount (integer cents) as keypad text — an edit's prefill or an AI
 * draft. Anything that is not a positive safe integer starts empty instead of
 * being coerced: "never silently corrupt financial data".
 */
export function seed(cents: number | null | undefined, decimals: number): CalcState {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents <= 0) return EMPTY_CALC;
  const evaluation = evaluateExpression(centsText(cents), decimals);
  return evaluation.ok ? { expression: evaluation.text, justEvaluated: false } : EMPTY_CALC;
}

function centsText(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export type ConfirmOutcome =
  | { kind: "submit"; state: CalcState }
  | { kind: "evaluated"; state: CalcState }
  | { kind: "error"; state: CalcState }
  | { kind: "none"; state: CalcState };

/**
 * ✓ — this keypad's "=" and "save" in one key. A plain number is ready to
 * save. An expression is evaluated in place first (a trailing operator is
 * dropped), so the result is on screen before a second ✓ saves it; nothing
 * the user has not seen is ever saved. An invalid expression (÷0, too large)
 * stays as typed so it can be fixed.
 */
export function confirm(state: CalcState, decimals: number): ConfirmOutcome {
  const trimmed = state.expression.replace(/[+−×÷]$/, "").replace(/\.$/, "");
  if (trimmed === "") return { kind: "none", state };
  if (!hasOperator(trimmed)) return { kind: "submit", state: { expression: trimmed, justEvaluated: false } };
  const evaluation = evaluateExpression(trimmed, decimals);
  if (!evaluation.ok) return { kind: "error", state };
  return { kind: "evaluated", state: { expression: evaluation.text, justEvaluated: true } };
}

export type RescaleOutcome = { state: CalcState; change: "none" | "rounded" | "cleared" };

/**
 * The wallet changed to a currency with fewer decimals (USD → VND) while
 * "12.5" is on the keypad. Never kept as typed — 12.5 VND does not exist.
 * The value is rounded half-up to the new currency's decimals, the same rule
 * as every other result, and the caller tells the user it happened.
 */
export function rescale(state: CalcState, decimals: number): RescaleOutcome {
  const fits = state.expression
    .split(/[+−×÷]/)
    .every((operand) => (operand.split(".")[1] ?? "").length <= decimals && (decimals > 0 || !operand.includes(".")));
  if (fits) return { state, change: "none" };
  const trimmed = state.expression.replace(/[+−×÷]$/, "");
  const evaluation = evaluateExpression(trimmed, decimals);
  if (!evaluation.ok || evaluation.cents <= 0) return { state: EMPTY_CALC, change: "cleared" };
  // "12." → "12" is a clean-up, not a rounding the user needs telling about.
  const exact = evaluateExpression(trimmed, API_MINOR_DIGITS);
  const changed = !exact.ok || exact.cents !== evaluation.cents;
  return { state: { expression: evaluation.text, justEvaluated: false }, change: changed ? "rounded" : "none" };
}
