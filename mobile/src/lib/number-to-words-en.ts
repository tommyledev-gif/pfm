const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
// Short scale, the US/modern UK reading: 10^9 is a billion, not a milliard.
const MAGNITUDES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion"];

// Reads one 0-999 group, US style: no "and" ("one hundred five"), a hyphen
// inside the tens ("forty-two").
function readGroup(group: number): string {
  const hundreds = Math.floor(group / 100);
  const rest = group % 100;
  const words: string[] = [];
  if (hundreds > 0) words.push(`${ONES[hundreds]} hundred`);
  if (rest >= 20) {
    const units = rest % 10;
    words.push(units > 0 ? `${TENS[Math.floor(rest / 10)]}-${ONES[units]}` : TENS[Math.floor(rest / 10)]);
  } else if (rest > 0) {
    words.push(ONES[rest]);
  }
  return words.join(" ");
}

// Spells out an integer in English, e.g. 9726010000 -> "nine billion seven
// hundred twenty-six million ten thousand". The English counterpart of
// numberToWordsVi: an all-zero group is skipped along with its own label.
export function numberToWordsEn(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return ONES[0];

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.unshift(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  groups.forEach((group, i) => {
    if (group === 0) return;
    const label = MAGNITUDES[groups.length - 1 - i] ?? "";
    const words = readGroup(group);
    parts.push(label ? `${words} ${label}` : words);
  });

  const result = parts.join(" ");
  return value < 0 ? `minus ${result}` : result;
}
