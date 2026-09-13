// Helpers for the "chi phí cố định" assistant on wizard screen 1.
//
// The problem it solves: "Chi phí cố định" asks for one number, but nobody
// holds that number in their head — they hold a list (nhà, điện, nước,
// internet, học phí…). Asking for the total makes the user do arithmetic on
// their phone, and the usual outcome is a round guess that is wrong by a
// million đồng, which then propagates into every figure the wizard produces.
//
// ⚠️ Parsing here is DETERMINISTIC, not an LLM call, and that is a deliberate
// choice rather than a shortcut:
//   - fixed costs are the easy end of natural language — "<nhãn> <số><đơn vị>"
//     with no frequency to infer, since everything here is monthly by
//     definition. Regex handles that reliably.
//   - the wizard's whole design keeps arithmetic out of the model (an LLM
//     mishearing "35k" as "350k" is a documented failure in this codebase's own
//     AI service), and the v2 spec requires a regex cross-check even where an
//     LLM IS used.
//   - it works with no network, instantly, and needs no backend deploy.
// If a model is added later it should ADD items this parser missed, never
// overwrite what it read.

/** One line of the fixed-cost breakdown. */
export interface FixedCostItem {
  /** Normalised label, used only for dedup between the two entry paths. */
  key: string;
  label: string;
  /** xu. */
  amountXu: number;
  /** Where it came from — drives the merge rule and the row's badge. */
  source: "typed" | "suggested";
}

/** Strips accents, punctuation and case so "Điện " and "dien" collide. */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Trailing period markers the user writes but that carry no information here —
// every fixed cost is monthly by definition, so "/tháng" is noise to strip, not
// a frequency to parse.
const PERIOD_SUFFIX = /(\/|mỗi|moi)?\s*(tháng|thang|month|mo)\s*$/i;

// One amount: a digit group that may carry Vietnamese thousands separators or a
// decimal separator, an optional unit, and the "2tr5" shorthand where the digits
// AFTER the unit are a fraction of it.
const AMOUNT_RE = /(\d+(?:[.,]\d+)*)\s*(k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|m|đ|d|vnd)?\s*(\d+)?/gi;

/**
 * Reads a Vietnamese-formatted number.
 *
 * ⚠️ In Vietnamese "." groups thousands and "," marks decimals — the opposite of
 * the English convention JavaScript's Number() assumes. Passing "300.000"
 * straight to Number() yields 300, so "điện 300.000" became three hundred đồng:
 * a thousand-fold error, in a field that feeds every other number the wizard
 * produces, with nothing on screen to suggest anything went wrong.
 *
 * Separators are classified by what follows them rather than by which character
 * they are, because people write both: a group of exactly three digits is a
 * thousands group, one or two digits is a decimal.
 */
function parseVietnameseNumber(raw: string): number {
  // 1.200.000 / 300,000 — every separator followed by exactly three digits.
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
  // 1,5 / 3.5 — a single separator with one or two digits after it.
  const decimal = raw.match(/^(\d+)[.,](\d{1,2})$/);
  if (decimal) return Number(`${decimal[1]}.${decimal[2]}`);
  // Anything else (plain digits, or a shape we do not recognise) is read
  // literally rather than guessed at.
  return Number(raw.replace(/[.,]/g, ""));
}

function unitMultiplier(unit: string | undefined): number {
  if (!unit) return 1;
  const u = unit.toLowerCase();
  if (u === "k" || u.startsWith("ngh") || u.startsWith("ng")) return 1_000;
  if (u === "tr" || u === "m" || u.startsWith("tri")) return 1_000_000;
  return 1; // đ / d / vnd / bare number
}

/**
 * Reads the LAST amount out of one chunk and treats everything before it as the
 * label.
 *
 * Last, not first, because Vietnamese puts the label in front — "gửi xe máy
 * 100k". Taking the first match would misread any label containing a digit
 * ("wifi 5G 160k") as the amount.
 */
function parseChunk(chunk: string): FixedCostItem | null {
  const text = chunk.replace(PERIOD_SUFFIX, "").trim();
  if (!text) return null;

  AMOUNT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = AMOUNT_RE.exec(text)) !== null) last = match;
  if (!last) return null;

  const [, digits, unit, fractionDigits] = last;
  const multiplier = unitMultiplier(unit);

  let value = parseVietnameseNumber(digits);
  if (!Number.isFinite(value)) return null;

  // "2tr5" = 2.5tr, "2tr25" = 2.25tr — the digits after the unit are a decimal
  // fraction of it, not a separate number.
  if (fractionDigits && multiplier > 1) {
    value += Number(`0.${fractionDigits}`);
  }

  const label = text.slice(0, last.index).trim() || text.trim();
  const amountDong = Math.round(value * multiplier);
  if (amountDong <= 0) return null;

  return {
    key: normalizeLabel(label),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    amountXu: amountDong * 100,
    source: "typed",
  };
}

/**
 * Splits a free-text description into items.
 *
 * Accepts commas, semicolons and newlines as separators — people mix all three,
 * and refusing one of them would silently merge two costs into one line whose
 * label reads fine and whose amount is wrong.
 *
 * ⚠️ A comma is BOTH a list separator and a decimal point in Vietnamese.
 * Splitting on every comma tore "bảo hiểm 1,5tr" into "bảo hiểm 1" and "5tr" —
 * two wrong rows in place of one right one, and the first of them read as a
 * plausible "Bảo hiểm 1đ". A comma glued to a digit belongs to the number;
 * only one followed by anything else separates items.
 */
export function parseFixedCosts(text: string): FixedCostItem[] {
  return text
    .split(/[;\n]+|,(?!\d)/)
    .map((chunk) => parseChunk(chunk))
    .filter((item): item is FixedCostItem => item !== null);
}

/**
 * The prompts the guided path offers.
 *
 * Rule-based, not model-generated. These are the recurring costs almost every
 * Vietnamese household has, and a fixed list is instant, works offline, and
 * cannot invent a category that does not apply. `systemKey` links a prompt to a
 * real system category where one exists (class `fixed` — see
 * common.SystemCategoryClass); the rest are real costs that are simply not
 * categories in this app.
 */
export const FIXED_COST_PROMPTS: { key: string; label: string; systemKey?: string }[] = [
  { key: "thue nha", label: "Thuê nhà / trả góp", systemKey: "housing" },
  { key: "dien", label: "Điện", systemKey: "utilities" },
  { key: "nuoc", label: "Nước", systemKey: "utilities" },
  { key: "internet", label: "Internet", systemKey: "utilities" },
  { key: "phi quan ly", label: "Phí quản lý / dịch vụ" },
  { key: "gui xe", label: "Gửi xe" },
  { key: "hoc phi", label: "Học phí", systemKey: "children_education" },
  { key: "bao hiem", label: "Bảo hiểm" },
];

/**
 * Union of the two entry paths, with typed text winning every collision.
 *
 * The rule is asymmetric on purpose. A suggestion is the app guessing that a
 * cost applies; typed text is the user stating that it does, and what it costs.
 * When both describe the same thing the user's own words are the better source,
 * so they replace rather than merge. Everything the other path uniquely knows
 * is kept — that is the whole reason both exist.
 */
export function mergeFixedCosts(typed: FixedCostItem[], suggested: FixedCostItem[]): FixedCostItem[] {
  const typedKeys = typed.map((t) => t.key);
  // Containment, not equality: people write "chi phí quản lý căn hộ" where the
  // prompt says "phí quản lý", and "gửi xe máy" where it says "gửi xe". Exact
  // key matching would keep both and double-count the cost, which is the one
  // outcome a merge must not produce.
  //
  // The known false positive is a short key landing inside an unrelated longer
  // one — "điện" inside "điện thoại". That suppresses a PROMPT, never any
  // figure the user entered, so the cost of being wrong is one missing
  // suggestion rather than a wrong total.
  const overridden = (s: FixedCostItem) =>
    typedKeys.some((t) => t === s.key || t.includes(s.key) || s.key.includes(t));

  // Typed first: it is the user's own list, in the order they wrote it.
  return [...typed, ...suggested.filter((s) => !overridden(s))];
}

export function totalFixedCosts(items: FixedCostItem[]): number {
  return items.reduce((sum, item) => sum + item.amountXu, 0);
}

/** Room the hint has on screen before it starts pushing the layout around. */
const SUMMARY_MAX_CHARS = 25;

/**
 * A one-line reminder of what the fixed-cost total is actually made of.
 *
 * Once the helper has been used, the field's generic hint ("nhà, điện nước,
 * internet, học phí") is no longer the useful thing to show — it describes the
 * category in the abstract while the user now has a concrete list, and a total
 * with no breakdown is a number they have to trust blindly. Showing the real
 * labels lets them notice at a glance that they forgot the internet.
 *
 * Truncated rather than wrapped: this sits on a single row beside the helper
 * link, and a hint that grows to three lines shoves the savings section down the
 * screen every time someone adds a cost.
 */
export function summarizeFixedCosts(items: FixedCostItem[], maxChars = SUMMARY_MAX_CHARS): string {
  const joined = items.map((item) => item.label).join(", ");
  if (joined.length <= maxChars) return joined;
  // The ellipsis counts toward the budget, so the result is never longer than
  // asked for.
  return `${joined.slice(0, maxChars - 1).trimEnd()}…`;
}
