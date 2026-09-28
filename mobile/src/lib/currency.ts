// Shared money formatter — mirrors frontend/src/lib/currency.ts exactly, so
// mobile and web never disagree on a VND-cents-to-display conversion (see
// specs/ai-chat-assistant's own live-tested cents-conversion bug — every
// amount from the API is integer cents and must go through here, never
// `amount / 100` inline in a component).
// ⚠️ The locale follows the CURRENCY, not the user. vi-VN formats every
// foreign currency by its ISO-ish fallback in the Vietnamese position —
// "64.646.464 US$" — which is a symbol nobody writes, in a place nobody writes
// it. VND keeps the Vietnamese conventions it belongs to (dot grouping,
// trailing ₫); everything else is written the way its own users write it
// ("$64,646,464").
const VND_LOCALE = "vi-VN";
const FOREIGN_LOCALE = "en-US";

function localeFor(currency: string): string {
  return currency.toUpperCase() === "VND" ? VND_LOCALE : FOREIGN_LOCALE;
}

function currencyFormat(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function formatCurrency(amountCents: number, currency: string = "VND"): string {
  return currencyFormat(currency).format(amountCents / 100);
}

// Inverse of the above — converts a form input collected in the wallet's
// display currency (e.g. a User typing "1000000" VND) into the integer cents
// the API expects. Never multiply by 100 inline in a component.
export function toCents(amountMajorUnits: number): number {
  return Math.round(amountMajorUnits * 100);
}

// Inverse of toCents — converts integer cents from the API into the major
// unit value an editable form input should display. Never divide by 100
// inline in a component.
export function toMajorUnits(amountCents: number): number {
  return amountCents / 100;
}

// Shortens an amount past 6 digits (>= 1,000,000 major units) to a
// "~7m100k"-style compact form (7,100,000 → "~7m100k" — whole millions plus
// the remainder rounded to the nearest thousand) instead of the
// fully-grouped "7.100.000" — used by DonutChart's center label and the
// Spending tab's Income/Expense stat cards, which have to fit a large amount
// into a small, fixed-width space. Replaces an earlier single-tenths-digit
// version ("7m1" for anything from 7.05m to 7.15m) that was too coarse to
// tell 7.08m and 7.1m apart — the leading "~" says plainly that this is a
// rounded display value, not the exact figure (long-press callers pair this
// with AmountRevealPopup for the exact one).
// Magnitude shorthand: k / triệu / tỷ. Named rather than inlined because
// several screens render these — the Insights donut and stat cards, the
// Transactions type tabs, Settings' three figures — and an abbreviation that
// differs between them reads as a different unit, not a different style.
//
// ⚠️ Thousands are "k", never "ng". "ng" abbreviates nghìn only in writing
// that spells the rest out too; jammed against a compacted figure it reads as
// a stray syllable ("7tr100ng"). "k" is what a Vietnamese reader already sees
// on every price tag ("50k").
const MAGNITUDE_SUFFIX = { thousand: "k", million: "tr", billion: "tỷ" } as const;

export function formatCurrencyCompact(amountCents: number, currency: string = "VND"): string {
  const amount = Math.round(amountCents / 100);
  const abs = Math.abs(amount);
  if (abs < 1_000_000) return formatCurrency(amountCents, currency);

  const sign = amount < 0 ? "-" : "";
  const isBillions = abs >= 1_000_000_000;
  const threshold = isBillions ? 1_000_000_000 : 1_000_000;
  const suffix = isBillions ? MAGNITUDE_SUFFIX.billion : MAGNITUDE_SUFFIX.million;
  // The sub-unit is one order of magnitude down from the main one (millions
  // → thousands, billions → millions) — always rounded, never truncated, so
  // "999.6k" reads as "1m" rather than a misleadingly-clipped "999k".
  const subUnit = isBillions ? 1_000_000 : 1_000;
  const subSuffix = isBillions ? MAGNITUDE_SUFFIX.million : MAGNITUDE_SUFFIX.thousand;

  let whole = Math.floor(abs / threshold);
  let subWhole = Math.round((abs % threshold) / subUnit);
  if (subWhole * subUnit >= threshold) {
    whole += 1;
    subWhole = 0;
  }

  const digits = `${whole}${suffix}${subWhole ? `${subWhole}${subSuffix}` : ""}`;
  const { symbol, symbolFirst } = currencyParts(currency);
  // The "~" stays in front of the whole thing either way — it qualifies the
  // figure, so it cannot sit between the symbol and its digits.
  return symbolFirst ? `~${sign}${symbol}${digits}` : `~${sign}${digits} ${symbol}`;
}

// Symbol AND its placement, both taken from the same formatter the full
// figures use — a compact amount that puts the symbol on the other side from
// formatCurrency's would read as a different currency.
function currencyParts(currency: string): { symbol: string; symbolFirst: boolean } {
  const parts = currencyFormat(currency).formatToParts(0);
  const symbolIndex = parts.findIndex((p) => p.type === "currency");
  const digitIndex = parts.findIndex((p) => p.type === "integer");
  return {
    symbol: symbolIndex === -1 ? currency : parts[symbolIndex].value,
    symbolFirst: symbolIndex !== -1 && digitIndex !== -1 && symbolIndex < digitIndex,
  };
}

const MAX_TRUNCATED_DIGITS = 9;

// Caps the displayed integer digit count at MAX_TRUNCATED_DIGITS and appends
// "…" — TransactionRow/TransactionActionCard render amounts next to other
// fixed content, and an unbounded 12+ digit number would wrap the row
// instead of just looking big. Pair with AmountRevealPopup (long-press) so
// the real value is always still reachable, never actually lost — this is a
// display cap, not data loss.
//
// Truncates the fully-formatted string itself (by counting digit
// characters) rather than re-formatting a sliced-off number, so whatever
// currency symbol/placement Intl produced for this locale is preserved
// as-is instead of being re-derived and risking a mismatch.
export function formatCurrencyTruncated(amountCents: number, currency: string = "VND"): string {
  const full = formatCurrency(amountCents, currency);
  const digitPositions: number[] = [];
  for (let i = 0; i < full.length; i++) {
    if (/\d/.test(full[i])) digitPositions.push(i);
  }
  if (digitPositions.length <= MAX_TRUNCATED_DIGITS) return full;

  const cutIndex = digitPositions[MAX_TRUNCATED_DIGITS - 1];
  const lastDigitIndex = digitPositions[digitPositions.length - 1];
  const suffix = full.slice(lastDigitIndex + 1);
  return `${full.slice(0, cutIndex + 1)}…${suffix}`;
}

// Per-day figures round DOWN to the nearest 1.000đ (100.000 xu).
//
// "còn 12.347đ" is arithmetic output; "còn 12.000đ" is something you can decide
// against while standing at a counter. Down, never nearest: rounding up would
// hand out money the budget does not have, and being a few hundred đồng
// pessimistic costs nothing.
const PER_DAY_ROUNDING_XU = 100_000;

export function floorToPerDayStep(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.floor(amountCents / PER_DAY_ROUNDING_XU) * PER_DAY_ROUNDING_XU;
}
