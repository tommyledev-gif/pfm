// Shared money formatter — mirrors frontend/src/lib/currency.ts exactly, so
// mobile and web never disagree on a VND-cents-to-display conversion (see
// specs/ai-chat-assistant's own live-tested cents-conversion bug — every
// amount from the API is integer cents and must go through here, never
// `amount / 100` inline in a component).
export function formatCurrency(amountCents: number, currency: string = "VND"): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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
// "7m5"-style compact form (7,513,211 → "7m5" — 7 whole millions, tenths
// digit only shown when non-zero) instead of the fully-grouped
// "7.513.211" — used by DonutChart's center label, which has to fit inside
// a fixed-diameter circle no matter how large the underlying amount gets.
export function formatCurrencyCompact(amountCents: number, currency: string = "VND"): string {
  const amount = Math.round(amountCents / 100);
  const abs = Math.abs(amount);
  if (abs < 1_000_000) return formatCurrency(amountCents, currency);

  const sign = amount < 0 ? "-" : "";
  const [threshold, suffix] = abs >= 1_000_000_000 ? [1_000_000_000, "b"] : [1_000_000, "m"];
  const whole = Math.floor(abs / threshold);
  const tenths = Math.floor((abs % threshold) / (threshold / 10));
  return `${sign}${whole}${suffix}${tenths ? tenths : ""} ${currencySymbol(currency)}`;
}

function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
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
