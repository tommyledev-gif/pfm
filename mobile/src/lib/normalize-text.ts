// A comparison key that ignores case, Vietnamese diacritics and spacing, so
// "Nhận lương" matches "nhan luong" and "  cafe  45k" equals "cafe 45k".
// Display always uses the original text; this is only for matching/deduping.
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}
