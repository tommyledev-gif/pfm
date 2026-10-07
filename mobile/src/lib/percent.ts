/**
 * A share as whole-percent text: 12.4 → "12%".
 *
 * The one exception: a share that is not zero but rounds to 0 reads "~1%".
 * Beside a huge figure (a 999.999.999.999đ category next to 100k ones), the
 * small ones rounded to "0%" — which says there is nothing there, when there
 * is. Exactly zero still reads "0%".
 */
export function formatPercent(percent: number): string {
  const rounded = Math.round(percent);
  if (rounded === 0 && percent > 0) return "~1%";
  return `${rounded}%`;
}
