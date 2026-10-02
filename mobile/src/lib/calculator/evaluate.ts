// The amount keypad's evaluator. Money is never a float here (CLAUDE.md:
// "Không dùng float cho tiền — ở bất kỳ layer nào") — every value is a bigint
// scaled by 10^INTERNAL_DIGITS, so 0.1 + 0.2 is exactly 0.3 and a division
// mid-expression keeps twelve decimals until the one final rounding.
//
// Decided rules (each is a test vector in the calculator test suite):
// - Precedence: × ÷ before + −, left to right within a level, as every
//   standard calculator does: 2+3×4 = 14, 8÷2×4 = 16.
// - No unary minus: an amount is positive and income/expense is the
//   transaction's type, so a leading "−" has no meaning — and would be an
//   open door to a negative amount.
// - Rounding: the final value only, half-up (away from zero), to the
//   currency's own decimals. 10÷3×3 is 10, not 9.99.
// - Every intermediate must stay under INTERMEDIATE_MAX; the result under
//   AMOUNT_MAX. Past either it is an error, never 1e+24.

export const OPERATOR_GLYPHS = ["+", "−", "×", "÷"] as const;
export type OperatorGlyph = (typeof OPERATOR_GLYPHS)[number];

/** Integer digits one operand may have: 999.999.999.999 at most. */
export const AMOUNT_MAX_INTEGER_DIGITS = 12;
/**
 * The largest amount, in cents, a transaction may carry — the same bound the
 * backend's DTO enforces (`lte=99999999999999`). Well inside
 * Number.MAX_SAFE_INTEGER, so cents can leave this file as a JS number.
 */
export const AMOUNT_MAX_CENTS = 99_999_999_999_999;
/** Cents are the API's unit, so no currency can carry more than two decimals here. */
export const API_MINOR_DIGITS = 2;

const INTERNAL_DIGITS = 12;
const TEN = BigInt(10);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const SCALE = TEN ** BigInt(INTERNAL_DIGITS);
const AMOUNT_MAX = (TEN ** BigInt(AMOUNT_MAX_INTEGER_DIGITS)) * SCALE - ONE;
// Far beyond any amount, so "999999999999 × 2 ÷ 2" still works, yet small
// enough that nothing absurd is ever carried along.
const INTERMEDIATE_MAX = (TEN ** BigInt(AMOUNT_MAX_INTEGER_DIGITS + 3)) * SCALE;

// What the evaluator reads. U+2212 MINUS SIGN, not the ASCII hyphen, is what
// the keypad inserts — mapping only "-" would make every subtraction fail.
const OPERATOR_OF: Record<string, "+" | "-" | "*" | "/"> = { "+": "+", "−": "-", "×": "*", "÷": "/" };

export type EvaluationError = "empty" | "incomplete" | "divide_by_zero" | "out_of_range" | "invalid";

export type Evaluation =
  | {
      ok: true;
      /** Rounded to the currency's decimals, in API cents. */
      cents: number;
      /** The same value as plain keypad text, trailing zeros dropped: "2.5", "10". */
      text: string;
      /** The exact value was above zero but rounded to nothing (VND 1÷3). */
      roundedToZero: boolean;
    }
  | { ok: false; error: EvaluationError };

type Token = { kind: "number"; text: string } | { kind: "operator"; op: "+" | "-" | "*" | "/" };

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression.charAt(i);
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i + 1;
      while (j < expression.length && /[0-9.]/.test(expression.charAt(j))) j++;
      tokens.push({ kind: "number", text: expression.slice(i, j) });
      i = j;
      continue;
    }
    const op = OPERATOR_OF[ch];
    if (op === undefined) return null;
    tokens.push({ kind: "operator", op });
    i++;
  }
  return tokens;
}

// "5." is 5 (a dangling point is not an error), ".5" is 0.5.
function parseLiteral(text: string): bigint | null {
  const normalized = (text.startsWith(".") ? `0${text}` : text).replace(/\.$/, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > INTERNAL_DIGITS) return null;
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(INTERNAL_DIGITS, "0"));
}

function abs(v: bigint): bigint {
  return v < ZERO ? -v : v;
}

/** n ÷ d, rounded half-up (away from zero). */
function roundDiv(n: bigint, d: bigint): bigint {
  const negative = n < ZERO !== d < ZERO;
  const q = (abs(n) * BigInt(2) + abs(d)) / (abs(d) * BigInt(2));
  return negative ? -q : q;
}

class EvalFailure extends Error {
  constructor(readonly reason: EvaluationError) {
    super(reason);
  }
}

function guard(value: bigint): bigint {
  if (abs(value) > INTERMEDIATE_MAX) throw new EvalFailure("out_of_range");
  return value;
}

function evaluateScaled(tokens: Token[]): bigint {
  let pos = 0;
  const operand = (): bigint => {
    const token = tokens[pos];
    if (token === undefined) throw new EvalFailure("incomplete");
    if (token.kind !== "number") throw new EvalFailure("invalid");
    pos++;
    const value = parseLiteral(token.text);
    if (value === null) throw new EvalFailure("invalid");
    return guard(value);
  };
  const nextOp = (...ops: string[]) => {
    const token = tokens[pos];
    return token?.kind === "operator" && ops.includes(token.op) ? token.op : null;
  };
  const term = (): bigint => {
    let value = operand();
    for (let op = nextOp("*", "/"); op; op = nextOp("*", "/")) {
      pos++;
      const rhs = operand();
      if (op === "/" && rhs === ZERO) throw new EvalFailure("divide_by_zero");
      value = guard(op === "*" ? roundDiv(value * rhs, SCALE) : roundDiv(value * SCALE, rhs));
    }
    return value;
  };
  let value = term();
  for (let op = nextOp("+", "-"); op; op = nextOp("+", "-")) {
    pos++;
    const rhs = term();
    value = guard(op === "+" ? value + rhs : value - rhs);
  }
  if (pos !== tokens.length) throw new EvalFailure("invalid");
  return value;
}

/** Scaled value → keypad text at `decimals`, trailing zeros dropped, never "-0". */
function toText(rounded: bigint, decimals: number): string {
  if (rounded === ZERO) return "0";
  const unit = TEN ** BigInt(decimals);
  const sign = rounded < ZERO ? "-" : "";
  const whole = (abs(rounded) / unit).toString();
  const fraction = decimals > 0 ? (abs(rounded) % unit).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Evaluates keypad text (digits, ".", + − × ÷) to `decimals` places.
 * `decimals` is the currency's own (0 for VND, 2 for USD), never above two.
 */
export function evaluateExpression(expression: string, decimals: number): Evaluation {
  if (expression === "") return { ok: false, error: "empty" };
  const tokens = tokenize(expression);
  if (tokens === null) return { ok: false, error: "invalid" };
  try {
    const scaled = evaluateScaled(tokens);
    const places = Math.min(Math.max(decimals, 0), API_MINOR_DIGITS);
    const rounded = roundDiv(scaled, TEN ** BigInt(INTERNAL_DIGITS - places));
    if (abs(rounded) * TEN ** BigInt(INTERNAL_DIGITS - places) > AMOUNT_MAX) return { ok: false, error: "out_of_range" };
    const cents = Number(rounded * TEN ** BigInt(API_MINOR_DIGITS - places));
    return { ok: true, cents: cents === 0 ? 0 : cents, text: toText(rounded, places), roundedToZero: rounded === ZERO && scaled > ZERO };
  } catch (e) {
    if (e instanceof EvalFailure) return { ok: false, error: e.reason };
    throw e;
  }
}
