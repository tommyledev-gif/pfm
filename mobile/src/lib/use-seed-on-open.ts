import { useState } from "react";

/**
 * Runs `seed` during render whenever `seedKey` changes to a non-null value;
 * `freshOpen` says the sheet was shut before.
 *
 * ⚠️ During render, not in an effect. An effect ran after the sheet's first
 * frame was drawn: the sheet opened empty (no wallet, no amount) and filled in
 * a commit or three later, each changing its height while it was still
 * sliding up, which flashed and shook. State set during render makes React
 * render again before committing, so the first frame drawn is the seeded
 * form. Keyed by what is edited: a background refetch of a list the form reads
 * used to re-seed and wipe what was being typed.
 *
 * `seedKey` is null while the sheet is closed.
 */
export function useSeedOnOpen(seedKey: string | null, seed: (freshOpen: boolean) => void) {
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (seedKey !== null) seed(seededFor === null);
  }
}
