import { useMemo } from "react";

import { normalizeText } from "@/lib/normalize-text";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useRecentPhrases } from "@/stores/recent-phrases-store";
import { useSavedPhrases } from "@/stores/saved-phrases-store";

// Re-rank only after typing pauses this long — keystrokes never wait on it.
export const PHRASE_FILTER_DEBOUNCE_MS = 300;
// More than this is a list nobody scrolls; the area is height-capped anyway.
const MAX_PHRASE_SUGGESTIONS = 30;

export interface PhraseSuggestion {
  text: string;
  saved: boolean;
}

interface Candidate extends PhraseSuggestion {
  key: string;
}

// Lower is better: starts-with beats contains; within each, saved beats recent.
function rank(candidate: Candidate, query: string): number | null {
  if (!query) return candidate.saved ? 0 : 1;
  const position = candidate.key.indexOf(query);
  if (position === -1) return null;
  const tier = position === 0 ? 0 : 2;
  return tier + (candidate.saved ? 0 : 1);
}

interface PhraseSuggestionOptions {
  /** The message already in the input: never suggested back to itself. */
  exclude: string;
  limit?: number;
  /** With nothing typed: every phrase (true), or none at all (false). */
  listAllWhenEmpty?: boolean;
}

/**
 * Saved phrases, then recently confirmed ones, filtered by `query` — ignoring
 * case and diacritics — once typing pauses. Never lists the exact text
 * already in the input. `total` is how many phrases there are to search.
 */
export function usePhraseSuggestions(
  query: string,
  userId: string | null,
  { exclude, limit = MAX_PHRASE_SUGGESTIONS, listAllWhenEmpty = true }: PhraseSuggestionOptions,
): { suggestions: PhraseSuggestion[]; total: number } {
  const saved = useSavedPhrases(userId);
  const recent = useRecentPhrases(userId);
  const debounced = normalizeText(useDebouncedValue(query, PHRASE_FILTER_DEBOUNCE_MS));
  const currentKey = normalizeText(exclude);

  // Saved first, each list already newest first; a recent phrase that is also
  // saved shows once, as saved.
  const candidates = useMemo<Candidate[]>(() => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const [list, isSaved] of [[saved, true], [recent, false]] as const) {
      for (const phrase of list) {
        const key = normalizeText(phrase.text);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text: phrase.text, saved: isSaved, key });
      }
    }
    return out;
  }, [saved, recent]);

  const suggestions = useMemo(() => {
    if (!debounced && !listAllWhenEmpty) return [];
    const ranked: { candidate: Candidate; score: number; order: number }[] = [];
    candidates.forEach((candidate, order) => {
      if (candidate.key === currentKey) return;
      const score = rank(candidate, debounced);
      if (score !== null) ranked.push({ candidate, score, order });
    });
    ranked.sort((a, b) => a.score - b.score || a.order - b.order);
    return ranked.slice(0, limit).map(({ candidate }) => ({
      text: candidate.text,
      saved: candidate.saved,
    }));
  }, [candidates, debounced, currentKey, limit, listAllWhenEmpty]);

  return { suggestions, total: candidates.length };
}
