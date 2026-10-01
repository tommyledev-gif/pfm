// Expression evaluator behind the amount keypad (CalculatorKeypad) —
// ported from reference-ui/calculatorEngine.ts, trimmed to what the keypad
// can actually type: numbers, + − × ÷, and a leading minus. No powers and no
// parentheses, since no key produces them.
//
// ⚠️ Money is never a float here (CLAUDE.md: "Không dùng float cho tiền — ở
// bất kỳ layer nào"). Every intermediate is a bigint scaled by 10^4 — two
// digits finer than cents, so a division mid-expression ("100 ÷ 3 × 3") does
// not lose a whole cent before the final rounding. Only the end result is
// rounded (half-up) to integer cents, the unit the API speaks.

export class CalculatorError extends Error {}

const SCALE_DIGITS = 4;
const SCALE = BigInt(10 ** SCALE_DIGITS);
const SCALED_PER_CENT = BigInt(10 ** (SCALE_DIGITS - 2));

// Cents leave this file as a JS number, so the result has to stay a safe
// integer: 12 integer digits (just under a trillion) is ~10^14 cents, well
// inside Number.MAX_SAFE_INTEGER, and far past any real personal amount.
export const AMOUNT_MAX_INTEGER_DIGITS = 12;
// Cents are the finest unit the backend stores — a third decimal could only
// ever be rounded away, so the keypad refuses to type one.
export const AMOUNT_MAX_DECIMALS = 2;
const MAX_MAGNITUDE = BigInt(10) ** BigInt(AMOUNT_MAX_INTEGER_DIGITS) * SCALE - BigInt(1);

// The glyphs the keypad inserts. ASCII aliases are accepted too, so an
// expression seeded from a plain number string still parses.
const OPERATOR_ALIASES: Record<string, Operator> = {
  "+": "+",
  "−": "-",
  "-": "-",
  "×": "*",
  "*": "*",
  "÷": "/",
  "/": "/",
};
const OPERATOR_GLYPHS = ["+", "−", "×", "÷"];
const OPERATOR_GLYPH_PATTERN = /[+−×÷]/g;

type Operator = "+" | "-" | "*" | "/";
type Token = { type: "number"; value: string } | { type: "operator"; value: Operator };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression.charAt(i);
    if (ch === " " || ch === ",") {
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i + 1;
      while (j < expression.length && /[0-9.,]/.test(expression.charAt(j))) j++;
      tokens.push({ type: "number", value: expression.slice(i, j).replace(/,/g, "") });
      i = j;
      continue;
    }
    const operator = OPERATOR_ALIASES[ch];
    if (operator === undefined) throw new CalculatorError(`Unexpected character: ${ch}`);
    tokens.push({ type: "operator", value: operator });
    i++;
  }
  return tokens;
}

function assertInRange(value: bigint): bigint {
  if ((value < BigInt(0) ? -value : value) > MAX_MAGNITUDE) throw new CalculatorError("Result out of range");
  return value;
}

// Half-up, symmetric around zero — the same rounding toCents' Math.round
// applies to a positive amount.
function roundDiv(numerator: bigint, denominator: bigint): bigint {
  const zero = BigInt(0);
  const negative = numerator < zero !== denominator < zero;
  const n = numerator < zero ? -numerator : numerator;
  const d = denominator < zero ? -denominator : denominator;
  const quotient = (n + d / BigInt(2)) / d;
  return negative ? -quotient : quotient;
}

function parseLiteral(raw: string): bigint {
  let text = raw;
  if (text.startsWith(".")) text = `0${text}`;
  if (text.endsWith(".")) text = text.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(text)) throw new CalculatorError(`Not a valid number: ${raw}`);
  const [integerPart, fractionPart = ""] = text.split(".");
  if (fractionPart.length > SCALE_DIGITS) throw new CalculatorError(`Too many decimals: ${raw}`);
  return assertInRange(BigInt(integerPart) * SCALE + BigInt(fractionPart.padEnd(SCALE_DIGITS, "0")));
}

/** Evaluates to a 10^4-scaled bigint; throws CalculatorError on anything incomplete or invalid. */
function evaluateScaled(expression: string): bigint {
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new CalculatorError("Empty expression");
  let pos = 0;

  const peekOperator = (...ops: Operator[]): Operator | null => {
    const token = tokens[pos];
    return token?.type === "operator" && ops.includes(token.value) ? token.value : null;
  };

  // unary := "-" unary | number
  function parseUnary(): bigint {
    if (peekOperator("-")) {
      pos++;
      return assertInRange(-parseUnary());
    }
    const token = tokens[pos];
    if (token?.type !== "number") throw new CalculatorError("Expected a number");
    pos++;
    return parseLiteral(token.value);
  }

  // term := unary (("*" | "/") unary)*
  function parseTerm(): bigint {
    let value = parseUnary();
    for (let op = peekOperator("*", "/"); op; op = peekOperator("*", "/")) {
      pos++;
      const rhs = parseUnary();
      if (op === "/" && rhs === BigInt(0)) throw new CalculatorError("Division by zero");
      value = assertInRange(op === "*" ? roundDiv(value * rhs, SCALE) : roundDiv(value * SCALE, rhs));
    }
    return value;
  }

  // expr := term (("+" | "-") term)*
  let value = parseTerm();
  for (let op = peekOperator("+", "-"); op; op = peekOperator("+", "-")) {
    pos++;
    const rhs = parseTerm();
    value = assertInRange(op === "+" ? value + rhs : value - rhs);
  }
  if (pos !== tokens.length) throw new CalculatorError("Unexpected trailing input");
  return value;
}

/** The expression's value in integer cents, or null while it is incomplete or invalid. */
export function evaluateToCents(expression: string): number | null {
  try {
    return Number(roundDiv(evaluateScaled(expression), SCALED_PER_CENT));
  } catch {
    return null;
  }
}

/** Integer cents → the plain expression an editable amount starts from: 150050 → "1500.5". */
export function centsToExpression(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function isOperatorGlyph(ch: string): boolean {
  return OPERATOR_GLYPHS.includes(ch);
}

/** True if an operator appears anywhere — "100 + 5", not just "100". A leading minus counts. */
export function hasOperator(expression: string): boolean {
  return [...expression].some(isOperatorGlyph);
}

/** True once the expression ends in an operator — "100 +", not "100". */
export function hasTrailingOperator(expression: string): boolean {
  const trimmed = expression.trim();
  return trimmed.length > 0 && isOperatorGlyph(trimmed.charAt(trimmed.length - 1));
}

/** The digits typed since the last operator — where a second "." or a third decimal would land. */
function currentNumberSegment(expression: string): string {
  let i = expression.length - 1;
  while (i >= 0 && !isOperatorGlyph(expression.charAt(i))) i--;
  return expression.slice(i + 1);
}

/**
 * Appends one keypad token, with the guards a plain string-concat keypad
 * cannot express: a second operator in a row replaces the first ("100+" then
 * "×" is "100×", never "100+×"), a second "." in the same number is ignored,
 * and a digit past the precision or size limits is ignored rather than
 * producing a number that can only fail later. A leading zero is replaced
 * rather than kept, so "0" then "5" reads "5", not "05".
 */
export function insertToken(expression: string, token: string): string {
  const segment = currentNumberSegment(expression);
  if (token === ".") {
    if (segment.includes(".")) return expression;
    return segment === "" ? `${expression}0.` : expression + token;
  }
  if (isOperatorGlyph(token)) {
    // Only a minus can open an expression (a negative number); any other
    // operator with nothing before it has nothing to operate on.
    if (expression === "") return token === "−" ? token : expression;
    return isOperatorGlyph(expression.charAt(expression.length - 1))
      ? expression.slice(0, -1) + token
      : expression + token;
  }
  const [integerPart, fractionPart] = segment.split(".");
  if (fractionPart !== undefined && fractionPart.length >= AMOUNT_MAX_DECIMALS) return expression;
  if (fractionPart === undefined && integerPart.length >= AMOUNT_MAX_INTEGER_DIGITS) return expression;
  if (segment === "0") return expression.slice(0, -1) + token;
  return expression + token;
}

/** Thousands-grouped with "," — the separator AmountInput already uses, since "." is the decimal key. */
function groupNumber(text: string): string {
  const [integerPart, fractionPart] = text.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionPart !== undefined ? `${grouped}.${fractionPart}` : grouped;
}

/**
 * What the amount display shows: the expression exactly as typed (grouped,
 * operators spaced), never a running total — a running total shows a wrong
 * intermediate while an operand is still being typed ("5 + 3" while heading
 * for "5 + 30"). `empty` is shown for a blank expression.
 */
export function formatExpressionDisplay(expression: string, empty = "0"): string {
  if (expression.trim() === "") return empty;
  return expression
    .replace(/[0-9.]+/g, groupNumber)
    .replace(OPERATOR_GLYPH_PATTERN, " $& ")
    .replace(/ {2,}/g, " ")
    .replace(/^ − /, "−")
    .trim();
}

export type ConfirmOutcome = { submit: true } | { edit: string } | null;

/**
 * What one confirm (✓) tap does, as in the reference: a plain number submits;
 * an operator expression is first trimmed of a dangling operator, or
 * evaluated in place, so the result can be reviewed before it is saved.
 * `null` means it cannot be resolved yet and the user keeps typing.
 */
export function confirmExpression(expression: string): ConfirmOutcome {
  const trimmed = expression.trim();
  if (!hasOperator(trimmed) || /^−[0-9.]+$/.test(trimmed)) return { submit: true };
  if (hasTrailingOperator(trimmed)) return { edit: trimmed.slice(0, -1) };
  const cents = evaluateToCents(trimmed);
  return cents === null ? null : { edit: centsToExpression(cents).replace(/^-/, "−") };
}
