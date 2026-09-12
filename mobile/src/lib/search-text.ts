// Diacritic-insensitive text matching for Vietnamese category/wallet names.
//
// A plain `toLowerCase().includes()` makes a search box near-useless here:
// typing "an uong" never matches "Ăn uống", and on a phone keyboard that is
// how most people type. Stripping combining marks (NFD → drop U+0300–U+036F)
// folds both sides to the same ASCII-ish form first. Đ/đ has no combining
// mark to strip, so it is mapped explicitly.
export function normalizeForSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesSearch(haystack: string, needle: string): boolean {
  const query = normalizeForSearch(needle);
  if (!query) return true;
  return normalizeForSearch(haystack).includes(query);
}
