import { categoryPalette } from "@/lib/theme";

// Categories have no `color` field on the backend (only a free-text `icon`
// string), so color is derived client-side from a stable hash of the
// category id — the same category always renders the same color across
// screens/sessions without needing server state for it.
function hashOf(categoryId: string): number {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Single-category contexts (one row, one card, one chat bubble) where
// nothing else is on screen to collide with — a plain hash into the palette
// is enough. Anywhere several categories are rendered *together* (Insights'
// donut + legend, the budget list), use buildCategoryColorMap instead: a
// hash alone can hand two different categories the same slot, which on a
// chart reads as "these two are the same category".
export function colorForCategory(categoryId: string): string {
  return categoryPalette[hashOf(categoryId) % categoryPalette.length];
}

// Assigns every id in `categoryIds` a color that is unique within that set,
// while still being stable per id: each id starts at its own hashed slot and
// linear-probes forward only when that slot is already taken by an earlier
// id in the same set. So a given category keeps the same color run to run
// (nothing here depends on wall-clock time or insertion order beyond the
// caller's own stable ordering), but two categories can never share one
// while there are free slots left.
//
// Past `categoryPalette.length` (50) distinct ids in one view, uniqueness is
// impossible — the overflow falls back to the plain hash color rather than
// throwing or rendering something colorless.
export function buildCategoryColorMap(categoryIds: string[]): Map<string, string> {
  const assigned = new Map<string, string>();
  const takenSlots = new Set<number>();
  const paletteSize = categoryPalette.length;

  for (const id of categoryIds) {
    if (assigned.has(id)) continue;

    if (takenSlots.size >= paletteSize) {
      assigned.set(id, colorForCategory(id));
      continue;
    }

    const preferred = hashOf(id) % paletteSize;
    let slot = preferred;
    while (takenSlots.has(slot)) {
      slot = (slot + 1) % paletteSize;
    }
    takenSlots.add(slot);
    assigned.set(id, categoryPalette[slot]);
  }

  return assigned;
}

export function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
