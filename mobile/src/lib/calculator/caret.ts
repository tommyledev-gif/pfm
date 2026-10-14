import { AMOUNT_MAX_INTEGER_DIGITS, OPERATOR_GLYPHS } from "@/lib/calculator/evaluate";
import { CalcState, KeypadKey, MAX_EXPRESSION_LENGTH, pressKey } from "@/lib/calculator/input";

// Editing the amount in the middle (2026-10-14): the caret is an index into
// the raw expression ("1500+250", no grouping). A key is typed as if the text
// ended at the caret, so input.ts's rules for the number being typed still
// decide what the key does; the text after the caret is then put back and the
// whole is checked again. Anything the end-of-text rules would never produce
// (two operators in a row, two points in one number, too many digits) is
// refused, never repaired behind the user's back.

export interface CaretEdit {
  expression: string;
  caret: number;
  accepted: boolean;
}

const isOperator = (ch: string) => (OPERATOR_GLYPHS as readonly string[]).includes(ch);

/**
 * Drops each number's leading zeros ("007" → "7", "00.5" → "0.5"), which a
 * digit typed before a 0 or a deleted first digit can leave, keeping the
 * caret on the same digit.
 */
function dropLeadingZeros(expression: string, caret: number): { expression: string; caret: number } {
  let out = "";
  let nextCaret = caret;
  let i = 0;
  while (i < expression.length) {
    if (isOperator(expression.charAt(i))) {
      out += expression.charAt(i);
      i += 1;
      continue;
    }
    let end = i;
    while (end < expression.length && !isOperator(expression.charAt(end))) end += 1;
    const operand = expression.slice(i, end);
    const whole = operand.split(".")[0];
    let drop = 0;
    while (drop < whole.length - 1 && whole.charAt(drop) === "0") drop += 1;
    if (caret > i) nextCaret -= Math.min(drop, caret - i);
    out += operand.slice(drop);
    i = end;
  }
  return { expression: out, caret: nextCaret };
}

/** Whether the keypad's own rules could have produced this text. */
export function isValidExpression(expression: string, decimals: number): boolean {
  if (expression.length > MAX_EXPRESSION_LENGTH) return false;
  if (expression === "") return true;
  // Operands at even indices, operators at odd ones.
  const parts = expression.split(/([+−×÷])/);
  for (let k = 0; k < parts.length; k += 2) {
    const operand = parts[k];
    const last = k === parts.length - 1;
    // Only a trailing operator leaves an empty operand ("5+").
    if (operand === "") {
      if (!last || k === 0) return false;
      continue;
    }
    if (!/^\d+(\.\d*)?$/.test(operand)) return false;
    const [whole, fraction] = operand.split(".");
    if (whole.length > AMOUNT_MAX_INTEGER_DIGITS) return false;
    if (fraction !== undefined) {
      if (fraction.length > decimals) return false;
      // A dangling point is only ever the number still being typed.
      if (fraction === "" && !last) return false;
    }
  }
  return true;
}

const refused = (state: CalcState, caret: number): CaretEdit => ({ expression: state.expression, caret, accepted: false });

/** One key at `caret` (0 … expression.length). */
export function pressKeyAt(state: CalcState, caret: number, key: KeypadKey, decimals: number): CaretEdit {
  const before = state.expression.slice(0, caret);
  const after = state.expression.slice(caret);
  const typed = pressKey({ expression: before, justEvaluated: false }, key, decimals);
  if (!typed.accepted) return refused(state, caret);
  const next = dropLeadingZeros(typed.state.expression + after, typed.state.expression.length);
  // A 0 typed in front of a number changes nothing: say so, like any refused key.
  if (next.expression === state.expression || !isValidExpression(next.expression, decimals)) return refused(state, caret);
  return { ...next, accepted: true };
}

/** ⌫ at `caret`: the character before it. */
export function backspaceAt(state: CalcState, caret: number, decimals: number): CaretEdit {
  if (caret <= 0) return refused(state, caret);
  const next = dropLeadingZeros(state.expression.slice(0, caret - 1) + state.expression.slice(caret), caret - 1);
  if (!isValidExpression(next.expression, decimals)) return refused(state, caret);
  return { ...next, accepted: true };
}
