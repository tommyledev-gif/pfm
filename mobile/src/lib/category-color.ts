import { categoryPalette } from "@/lib/theme";

// Categories have no `color` field on the backend (only a free-text `icon`
// string) — the design's colored icon circles are derived client-side via a
// stable hash of the category id, so the same category always renders the
// same color across screens/sessions without needing server state for it.
export function colorForCategory(categoryId: string): string {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return categoryPalette[hash % categoryPalette.length];
}

export function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
