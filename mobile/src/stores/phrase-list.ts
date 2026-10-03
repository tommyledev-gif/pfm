import { normalizeText } from "@/lib/normalize-text";

// A phrase kept on the device for one User: its exact wording, and when it
// was last saved/used (epoch ms, device clock — only ever used for ordering).
export interface StoredPhrase {
  text: string;
  at: number;
}

export type PhrasesByUser = Record<string, StoredPhrase[]>;

// Shared empty list, so a selector for a User with no phrases returns the same
// reference every time instead of a fresh [] that re-renders forever.
export const NO_PHRASES: StoredPhrase[] = [];

export function samePhrase(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

// Puts `text` first, dropping any earlier entry with the same normalized
// wording — the newest wording wins.
export function moveToFront(list: StoredPhrase[], text: string, at: number): StoredPhrase[] {
  return [{ text, at }, ...list.filter((p) => !samePhrase(p.text, text))];
}
