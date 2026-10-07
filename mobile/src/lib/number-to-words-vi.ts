import { toMajorUnits } from "@/lib/currency";

const DIGIT_WORDS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

// "mốt/tư/lăm" replace "một/bốn/năm" once a nonzero tens digit precedes them
// (21 = "hai mươi mốt", not "hai mươi một"); "lăm" additionally covers the
// mười-teens (15 = "mười lăm").
function unitWord(units: number, tensValue: number): string {
  if (units === 1 && tensValue >= 2) return "mốt";
  if (units === 4 && tensValue >= 2) return "tư";
  if (units === 5 && tensValue >= 1) return "lăm";
  return DIGIT_WORDS[units];
}

// Reads one 0-999 group. `isLeading` = this is the most-significant group of
// the whole number, so a zero hundreds digit is simply omitted rather than
// spoken as "không trăm" — nobody reads 26,000,000 as "không trăm hai mươi
// sáu triệu"; that prefix only appears once a bigger group already came
// before it (e.g. the "010" group in "... không trăm mười nghìn").
function readGroup(group: number, isLeading: boolean): string {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor((group % 100) / 10);
  const units = group % 10;
  const words: string[] = [];

  if (hundreds > 0) {
    words.push(`${DIGIT_WORDS[hundreds]} trăm`);
  } else if (!isLeading) {
    words.push("không trăm");
  }

  if (tens === 0) {
    if (units > 0) {
      words.push(hundreds > 0 || !isLeading ? `linh ${unitWord(units, 0)}` : unitWord(units, 0));
    }
  } else if (tens === 1) {
    words.push("mười");
    if (units > 0) words.push(unitWord(units, 1));
  } else {
    words.push(`${DIGIT_WORDS[tens]} mươi`);
    if (units > 0) words.push(unitWord(units, tens));
  }

  return words.join(" ");
}

// index 0 = the trailing hundreds/units group (no label), 1 = nghìn,
// 2 = triệu, 3 = tỷ; beyond that Vietnamese just keeps appending "tỷ"
// (nghìn tỷ, triệu tỷ, tỷ tỷ, nghìn tỷ tỷ, ...) every 3 groups, which this
// formula generalizes instead of hardcoding past "tỷ".
function magnitudeLabel(index: number): string {
  if (index === 0) return "";
  const base = ["", "nghìn", "triệu", "tỷ"];
  const cyclePos = 1 + ((index - 1) % 3);
  const tyRepeats = Math.floor((index - 1) / 3);
  return base[cyclePos] + " tỷ".repeat(tyRepeats);
}

// Spells out an integer VND amount in Vietnamese, e.g. 9726010000 ->
// "chín tỷ bảy trăm hai mươi sáu triệu không trăm mười nghìn" — used by
// AmountRevealPopup so a long-press on a truncated amount shows the value
// in a form that's actually easy to read/verify at a glance, not just more
// digits. An all-zero group (and only a zero group) is skipped entirely
// along with its own label — that's why the example above has nothing
// after "nghìn" even though the real number has 3 more trailing zeros.
export function numberToWordsVi(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "không";

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.unshift(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  groups.forEach((group, i) => {
    if (group === 0) return;
    const magnitudeIndex = groups.length - 1 - i;
    const label = magnitudeLabel(magnitudeIndex);
    const words = readGroup(group, i === 0);
    parts.push(label ? `${words} ${label}` : words);
  });

  const result = parts.join(" ");
  return value < 0 ? `âm ${result}` : result;
}

// What the spelled-out amount ends with — the unit, read the way it is said.
// A currency without a word here ends with its code ("… EUR").
const CURRENCY_WORDS: Record<string, string> = { VND: "đồng", USD: "đô la Mỹ" };

/**
 * An amount in cents, spelled out in Vietnamese with its currency at the end:
 * "một triệu năm trăm nghìn đồng". The figure above it already shows "₫";
 * the words used to stop at the number, so the line read as if it had no unit.
 */
export function amountInWordsVi(amountCents: number, currency: string): string {
  const code = currency.toUpperCase();
  return `${numberToWordsVi(toMajorUnits(amountCents))} ${CURRENCY_WORDS[code] ?? code}`;
}
