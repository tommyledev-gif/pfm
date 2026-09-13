import { Category } from "@/features/categories/types";
import { normalizeLabel } from "@/features/budget-wizard/fixed-costs";

/**
 * Finding the categories a typed name probably already means.
 *
 * WHY THIS EXISTS: the wizard lets someone add a budget line by typing a name.
 * Left alone, that produces "Cafe", "Cà phê" and "Coffee" as three separate
 * categories tracking one habit — and once transactions are attached to all
 * three, no report can put them back together. Catching the collision at the
 * moment of typing costs one dialog; catching it later costs a data migration.
 *
 * ⚠️ Deliberately conservative. A false positive interrupts someone who knew
 * exactly what they wanted, so the threshold is set where a match has to share
 * real substance — a whole word, or containment — not merely a few letters.
 * Missing a match is recoverable (they end up with a second category they can
 * merge later); nagging on every add is not, because people learn to dismiss
 * the dialog without reading it.
 */

export interface CategoryMatch {
  category: Category;
  /** 0..1. Only used to order the list; the dialog never shows it. */
  score: number;
}

/** Below this, two names are treated as unrelated. */
const MATCH_THRESHOLD = 0.45;

/** Words too common in Vietnamese category names to carry any signal. */
const STOPWORDS = new Set(["chi", "phi", "tien", "khoan", "cac", "va", "cho", "va2"]);

function tokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Containment: "cafe" inside "cafe giai tri", "an uong" inside "an uong ngoai".
  // Scored just under an exact match — one name is a more specific spelling of
  // the other rather than a different thing.
  if (a.includes(b) || b.includes(a)) return 0.85;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  if (shared === 0) return 0;

  // Jaccard over meaningful words. "cafe giai tri" vs "giai tri" shares one of
  // three distinct words — enough to raise, not enough to assume.
  const union = new Set([...ta, ...tb]).size;
  return shared / union;
}

/**
 * Categories that plausibly already mean `name`, best first.
 *
 * Only `expense` categories are considered: this is called from the budget
 * wizard, and a budget can only ever be set on something you spend.
 * Soft-deleted categories are excluded by the API, so anything here is a
 * category the user can actually be offered.
 */
export function findSimilarCategories(name: string, categories: Category[], limit = 4): CategoryMatch[] {
  const target = normalizeLabel(name);
  if (!target) return [];

  return categories
    .filter((c) => c.type === "expense")
    .map((category) => ({ category, score: similarity(target, normalizeLabel(category.name)) }))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.category.name.localeCompare(b.category.name))
    .slice(0, limit);
}
