import { API_MINOR_DIGITS } from "@/lib/calculator/evaluate";

// Display-only formatting for the amount keypad. The expression itself always
// uses "." as its decimal point and never carries a grouping separator; only
// what is drawn on screen is localised, and it follows the CURRENCY's own
// locale — the same rule lib/currency.ts applies to every stored amount.
//
// ⚠️ This is what keeps the vi-VN "." / "," swap from becoming a 1000×
// error. A VND amount has no decimals at all (its "." key is replaced by
// "000"), so its "." can only ever be a thousands separator — "1.000.000",
// exactly as formatCurrency writes it elsewhere. A USD amount groups with ","
// and uses "." for decimals. No currency shows one mark meaning both.

const VND_LOCALE = "vi-VN";
const FOREIGN_LOCALE = "en-US";
// The decimals each currency the app supports may carry, should Intl not
// say (some Hermes builds ship a reduced Intl).
const FALLBACK_DECIMALS: Record<string, number> = { VND: 0, USD: 2 };
const DEFAULT_DECIMALS = 2;

function localeFor(currency: string): string {
  return currency.toUpperCase() === "VND" ? VND_LOCALE : FOREIGN_LOCALE;
}

// ⚠️ Both answers below are fixed per currency, and each costs an
// Intl.NumberFormat — slow on Hermes for Android, very slow until its ICU has
// warmed up. The keypad asks for them on every press, so they are worked out
// once per currency and kept (see lib/currency.ts's formatCache, same reason).
const decimalsCache = new Map<string, number>();
const separatorsCache = new Map<string, { group: string; decimal: string }>();

/** How many decimals an amount in `currency` may have: VND 0, USD 2 — never more than the API's cents. */
export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  const cached = decimalsCache.get(code);
  if (cached !== undefined) return cached;
  let decimals = FALLBACK_DECIMALS[code] ?? DEFAULT_DECIMALS;
  try {
    decimals = new Intl.NumberFormat(FOREIGN_LOCALE, { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? decimals;
  } catch {
    // Unknown code or no Intl: keep the fallback.
  }
  const result = Math.min(decimals, API_MINOR_DIGITS);
  decimalsCache.set(code, result);
  return result;
}

function separators(currency: string): { group: string; decimal: string } {
  const code = currency.toUpperCase();
  const cached = separatorsCache.get(code);
  if (cached) return cached;
  let result: { group: string; decimal: string };
  try {
    const parts = new Intl.NumberFormat(localeFor(currency)).formatToParts(1000.5);
    result = {
      group: parts.find((p) => p.type === "group")?.value ?? ",",
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    };
  } catch {
    result = code === "VND" ? { group: ".", decimal: "," } : { group: ",", decimal: "." };
  }
  separatorsCache.set(code, result);
  return result;
}

/** One operand, grouped — a trailing "." is kept, so "1,000." still shows its point. */
function groupOperand(text: string, sep: { group: string; decimal: string }): string {
  const [whole, fraction] = text.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep.group);
  return fraction !== undefined ? `${grouped}${sep.decimal}${fraction}` : grouped;
}

/**
 * The expression as typed — grouped, operators spaced, never a running total
 * (that is the preview's job). `empty` is shown for a blank expression.
 */
export function formatExpression(expression: string, currency: string, empty = "0"): string {
  if (expression === "") return empty;
  const sep = separators(currency);
  return expression
    .replace(/[0-9.]+/g, (operand) => groupOperand(operand, sep))
    .replace(/[+−×÷]/g, " $& ")
    .trim();
}

/** A result value ("-5", "1234.5") in the same grouping, with a real minus sign. */
export function formatValue(text: string, currency: string): string {
  const negative = text.startsWith("-");
  const grouped = groupOperand(negative ? text.slice(1) : text, separators(currency));
  return negative ? `−${grouped}` : grouped;
}

const SPOKEN_OPERATOR: Record<string, string> = { "+": "cộng", "−": "trừ", "×": "nhân", "÷": "chia" };

/** What a screen reader says for the expression: "5 cộng 3", not "5 plus 3" or "5 dash 3". */
export function spokenExpression(expression: string): string {
  return expression.replace(/[+−×÷]/g, (op) => ` ${SPOKEN_OPERATOR[op]} `).replace(/\./g, " phẩy ").replace(/\s+/g, " ").trim();
}
