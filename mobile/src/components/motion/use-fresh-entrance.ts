import { useState } from "react";

import { EntrancePreset, entrance } from "@/components/motion/motion-tokens";

/** How recent an item must be, when its view mounts, to count as new. */
const FRESH_WINDOW_MS = 2000;

/**
 * The entering animation for an item that was created a moment ago, or
 * undefined for anything older: a chat message that just arrived rises in,
 * while the history around it (restored at launch, scrolled back into view,
 * remounted by a tab or mode switch) appears as it is.
 *
 * Decided once, when the view mounts, so a re-render never replays it. Pass
 * the result to an Animated view's `entering`, and keep that view in the tree
 * either way (or decide its presence from the same value) so nothing remounts.
 */
export function useFreshEntrance(createdAt: number | undefined, preset: EntrancePreset = "fadeUp") {
  const [entering] = useState(() =>
    createdAt !== undefined && Date.now() - createdAt < FRESH_WINDOW_MS ? entrance(preset) : undefined,
  );
  return entering;
}
