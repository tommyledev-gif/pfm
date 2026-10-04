import { toCents } from "@/lib/currency";

/** What a typed chat message can pre-fill in the manual form. */
export interface TransactionDraft {
  note: string;
  /** Integer cents (VND has no minor unit, so whole đồng × 100); null when no amount was found. */
  amountCents: number | null;
}

const THOUSAND = 1_000;
const MILLION = 1_000_000;

// Vietnamese money shorthand → multiplier. Longest first, so "triệu" is not
// read as "tr" followed by stray letters.
const UNIT_MULTIPLIERS: readonly [string, number][] = [
  ["triệu", MILLION],
  ["nghìn", THOUSAND],
  ["ngàn", THOUSAND],
  ["tr", MILLION],
  ["củ", MILLION],
  ["k", THOUSAND],
  ["m", MILLION],
];
const UNIT_PATTERN = UNIT_MULTIPLIERS.map(([unit]) => unit).join("|");

// A number, an optional unit, and optional trailing digits ("1tr2" = 1.2m,
// "2k5" = 2.5k) — ending where a word would carry on, so "5km" or "2m2"
// inside a word is not taken for money.
const AMOUNT_PATTERN = new RegExp(`(\\d[\\d.,]*)\\s*(${UNIT_PATTERN})?(\\d{1,3})?(?![\\p{L}\\d])`, "iu");
// Digits left after a unit fill the next places down: "1tr2" → 2 × 100k.
const TAIL_PLACES = 3;

function amountInDong(numberText: string, unit: string | undefined, tail: string | undefined): number | null {
  const multiplier = unit ? UNIT_MULTIPLIERS.find(([u]) => u === unit.toLowerCase())?.[1] : undefined;
  if (!multiplier) {
    // No unit: "." and "," are thousands separators ("50.000", "1,200,000").
    const whole = Number(numberText.replace(/[.,]/g, ""));
    return Number.isSafeInteger(whole) && whole > 0 ? whole : null;
  }
  // With a unit, a separator is a decimal point ("1.5tr", "2,5k").
  const base = Number(numberText.replace(",", "."));
  if (!Number.isFinite(base)) return null;
  const tailValue = tail ? (Number(tail.padEnd(TAIL_PLACES, "0")) * multiplier) / THOUSAND : 0;
  const dong = Math.round(base * multiplier + tailValue);
  return Number.isSafeInteger(dong) && dong > 0 ? dong : null;
}

/**
 * Reads the first amount out of a typed message, on the device — for when the
 * AI is unreachable and the text is handed to the manual form instead. The
 * rest of the text becomes the note. Never guesses a category or wallet; the
 * User picks those in the form.
 */
export function draftFromText(text: string): TransactionDraft {
  const trimmed = text.trim();
  const match = AMOUNT_PATTERN.exec(trimmed);
  const dong = match ? amountInDong(match[1], match[2], match[3]) : null;
  if (!match || dong === null) return { note: trimmed, amountCents: null };

  const note = `${trimmed.slice(0, match.index)} ${trimmed.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .trim();
  return { note, amountCents: toCents(dong) };
}
